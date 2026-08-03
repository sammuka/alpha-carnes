import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { operacoes,
  notasFiscais,
  faturamentos,
  caminhoes,
  pedidosVenda,
  clientes,
  parametros,
 } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  NFSE_GATEWAY,
  type NfseGateway,
  type NfseResultado,
  type EmitirNfseRequest,
  NfseTransporteError,
} from '../../../integracoes/nfse/nfse.types';
import { montarPayloadEiss, redigirSegredos, type DadosFiscaisEmissao } from '../../../integracoes/nfse/payload-builder';
import { EVENTOS } from '../../../realtime/events/eventos';
import { assertTransicaoNfse, type StatusNfse } from './transicoes-nfse';
import type { EmitirNfseDto, CancelarNfseDto } from './dto/faturamento.dto';
import { ConsolidacaoService } from './consolidacao.service';
import { LiberacaoService } from '../expedicao/liberacao.service';

const RETRY_MAX = 3;
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000];

interface GatewayResult {
  resultado: NfseResultado | null;
  erroFinal: Error | null;
  tentativas: number;
}

@Injectable()
export class FaturamentoService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    @Inject(NFSE_GATEWAY) private readonly gateway: NfseGateway,
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly consolidacaoService: ConsolidacaoService,
    private readonly liberacaoService: LiberacaoService,
  ) {}

  private get db() { return this.drizzle.db; }

  /** D10.3 — fila em memória: serializa emissões (manual: "requisições simultâneas podem falhar ambas"). */
  private emissaoEmAndamento: Promise<unknown> = Promise.resolve();

  /** Encadeia `tarefa` após a emissão em andamento, garantindo execução em série. */
  private async serializarEmissao<T>(tarefa: () => Promise<T>): Promise<T> {
    const anterior = this.emissaoEmAndamento.catch(() => undefined);
    const atual = anterior.then(tarefa);
    this.emissaoEmAndamento = atual.catch(() => undefined);
    return atual;
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  /** D10.2 — lê parâmetros fiscais e monta DadosFiscaisEmissao para o payload-builder. */
  private async buscarDadosFiscaisEmissao(): Promise<DadosFiscaisEmissao> {
    const linhas = await this.db.select().from(parametros).where(
      inArray(parametros.chave, [
        'faturamento.codigo_servico_atividade', 'faturamento.simples_nacional', 'faturamento.modelo_fiscal',
        'faturamento.rtc_class_trib', 'faturamento.rtc_codigo_nbs', 'faturamento.rtc_ind_operacao', 'faturamento.rtc_id_local_incidencia',
      ]),
    );
    const mapa = new Map(linhas.map((l) => [l.chave, (l.valorJson as { valor?: unknown })?.valor]));
    const modeloFiscal = (mapa.get('faturamento.modelo_fiscal') ?? 'padrao') as 'padrao' | 'rtc';
    const atividade = String(mapa.get('faturamento.codigo_servico_atividade') ?? '14.01');
    const simplesNacional = mapa.get('faturamento.simples_nacional') === true;

    if (modeloFiscal === 'rtc') {
      const rtc = {
        classTrib: String(mapa.get('faturamento.rtc_class_trib') ?? ''),
        codigoNbs: String(mapa.get('faturamento.rtc_codigo_nbs') ?? ''),
        indOperacao: String(mapa.get('faturamento.rtc_ind_operacao') ?? ''),
        idLocalIncidencia: String(mapa.get('faturamento.rtc_id_local_incidencia') ?? ''),
      };
      if (!rtc.classTrib || !rtc.codigoNbs || !rtc.indOperacao || !rtc.idLocalIncidencia) {
        throw new ConflictException({ codigo: 'RTC_PARAMETROS_INCOMPLETOS', message: 'Parâmetros RTC incompletos — configure faturamento.rtc_* antes de emitir' });
      }
      return { atividade, simplesNacional, modeloFiscal, rtc };
    }
    return { atividade, simplesNacional, modeloFiscal };
  }

  /**
   * Fase B — loop de retry com gateway EISS, FORA de qualquer transação de banco.
   * Em timeout, consulta antes de retransmitir (anti-nota-fantasma, codigos-erro.md).
   */
  private async chamarGateway(
    reqComToken: EmitirNfseRequest,
    homologacao: boolean,
  ): Promise<GatewayResult> {
    let tentativas = 0;
    let resultado: NfseResultado | null = null;
    let erroFinal: Error | null = null;

    while (tentativas < RETRY_MAX) {
      try {
        const res = await this.gateway.emitir(reqComToken);
        if (!res.erro) { resultado = res; break; }
        // Erro de negócio EISS (Erro=true) — não-retriável, sair imediatamente
        erroFinal = new Error(res.mensagemErro ?? 'Erro de negócio EISS');
        resultado = res;
        break;
      } catch (e) {
        if (!(e instanceof NfseTransporteError)) { erroFinal = e as Error; break; }
        tentativas++;
        if (e.message.toLowerCase().includes('timeout')) {
          try {
            // Sem numeroNota (timeout na emissão) — reconciliação só por identificador (D10.1).
            const consulta = await this.gateway.consultarNotaCompleta({
              chaveAutenticacao: reqComToken.chaveAutenticacao,
              homologacao,
              identificador: reqComToken.identificador,
            });
            if (!consulta.erro && consulta.numeroNota) { resultado = consulta; break; }
          } catch { /* consulta falhou — seguir para retry */ }
        }
        if (tentativas < RETRY_MAX) {
          const delay = parseInt(
            process.env['EISS_RETRY_DELAY_MS'] ?? String(RETRY_DELAYS_MS[tentativas - 1] ?? 5000), 10,
          );
          await new Promise(r => setTimeout(r, delay));
        } else {
          erroFinal = e;
        }
      }
    }

    return { resultado, erroFinal, tentativas };
  }

  /**
   * Fase C — persiste resultado de emissão na NF indicada (tx curta) e emite evento após commit.
   * Recebe o payload de request SEM token para auditoria (redigirSegredos garante a sanitização).
   */
  private async persistirResultadoEmissao(
    notaFiscalId: string,
    notaAnterior: typeof notasFiscais.$inferSelect,
    gwResult: GatewayResult,
    reqParaAudit: Record<string, unknown>,
    ctx: { caminhaoId: string; pedidoVendaId: string; dataOperacao: string; usuarioId: string },
    modeloFiscal: 'padrao' | 'rtc' = 'padrao',
  ): Promise<typeof notasFiscais.$inferSelect> {
    const { resultado, erroFinal, tentativas } = gwResult;
    const payloadAuditoria = redigirSegredos({ request: reqParaAudit, response: resultado ?? erroFinal?.message });
    let notaAtualizada: typeof notasFiscais.$inferSelect;

    if (resultado && !resultado.erro) {
      assertTransicaoNfse('pendente', 'emitida');
      notaAtualizada = await this.db.transaction(async (tx) => {
        const [nf] = await tx.update(notasFiscais).set({
          statusNfse: 'emitida',
          numeroNfse: resultado.numeroNota ?? null,
          codigoVerificacao: resultado.codigoVerificacao ?? null,
          linkNfse: resultado.linkNota ?? null,
          emitidaEm: new Date(),
          tentativasEmissao: tentativas,
          payloadEiss: payloadAuditoria as Record<string, unknown>,
          modeloFiscal,
        }).where(eq(notasFiscais.id, notaFiscalId)).returning();
        if (!nf) throw new Error('Falha ao atualizar nota fiscal');
        await this.auditoria.registrar(tx, {
          tabela: 'notas_fiscais', registroId: nf.id, operacao: 'UPDATE',
          modulo: 'faturamento', usuarioId: ctx.usuarioId,
          dadosAnteriores: notaAnterior, dadosNovos: nf,
        });
        return nf;
      });
      this.eventEmitter.emit(EVENTOS.NFSE_EMITIDA, {
        caminhaoId: ctx.caminhaoId, notaFiscalId,
        pedidoVendaId: ctx.pedidoVendaId, numeroNfse: notaAtualizada.numeroNfse,
        dataOperacao: ctx.dataOperacao,
      });
      await this.liberacaoService.sincronizarPosEmissao(ctx.caminhaoId, ctx.usuarioId);
    } else {
      assertTransicaoNfse('pendente', 'erro_emissao');
      const mensagemErro = resultado?.mensagemErro ?? erroFinal?.message ?? 'Erro desconhecido';
      notaAtualizada = await this.db.transaction(async (tx) => {
        const [nf] = await tx.update(notasFiscais).set({
          statusNfse: 'erro_emissao', ultimoErroNfse: mensagemErro,
          tentativasEmissao: tentativas, payloadEiss: payloadAuditoria as Record<string, unknown>,
          modeloFiscal,
        }).where(eq(notasFiscais.id, notaFiscalId)).returning();
        if (!nf) throw new Error('Falha ao atualizar nota fiscal');
        await this.auditoria.registrar(tx, {
          tabela: 'notas_fiscais', registroId: nf.id, operacao: 'UPDATE',
          modulo: 'faturamento', usuarioId: ctx.usuarioId,
          dadosAnteriores: notaAnterior, dadosNovos: nf,
        });
        return nf;
      });
      this.eventEmitter.emit(EVENTOS.NFSE_ERRO_EMISSAO, {
        caminhaoId: ctx.caminhaoId, notaFiscalId,
        pedidoVendaId: ctx.pedidoVendaId, ultimoErro: mensagemErro,
        tentativas, dataOperacao: ctx.dataOperacao,
      });
    }

    return notaAtualizada;
  }

  // ── Métodos públicos ────────────────────────────────────────────────────────

  /**
   * Emite NFS-e para um pedido dentro do faturamento de um caminhão.
   * Fluxo em 3 fases: claim atômico (tx curta) → gateway fora de tx → persistir (tx curta).
   */
  async emitir(caminhaoId: string, dto: EmitirNfseDto, usuarioId: string) {
    // ── Fase A: validações e claim atômico (tx curta → commit imediato) ────────

    const faturamento = await this.db.select().from(faturamentos)
      .where(and(eq(faturamentos.caminhaoId, caminhaoId), isNull(faturamentos.deletedAt)))
      .then(r => r[0] ?? null);
    if (!faturamento) throw new ConflictException('Consolidação necessária antes de emitir');

    const caminhao = await this.db.select().from(caminhoes)
      .where(and(eq(caminhoes.id, caminhaoId), isNull(caminhoes.deletedAt)))
      .then(r => r[0] ?? null);
    if (!caminhao) throw new ConflictException('Caminhão não encontrado');
    if (caminhao.statusCaminhao !== 'fechado' && caminhao.statusCaminhao !== 'liberado_faturamento') {
      throw new ConflictException(`Emissão só para caminhão 'fechado'. Status: ${caminhao.statusCaminhao}`);
    }

    const pedidoRow = await this.db.select({ pedido: pedidosVenda, cliente: clientes })
      .from(pedidosVenda)
      .innerJoin(clientes, eq(pedidosVenda.clienteId, clientes.id))
      .where(and(eq(pedidosVenda.id, dto.pedidoVendaId), isNull(pedidosVenda.deletedAt)))
      .then(r => r[0] ?? null);
    if (!pedidoRow) throw new ConflictException('Pedido não encontrado');

    const consolidacao = await this.consolidacaoService.consolidar(caminhaoId, usuarioId);
    if (consolidacao.bloqueios.length > 0) {
      throw new ConflictException({
        message: 'Emissão bloqueada por pendências críticas',
        bloqueios: consolidacao.bloqueios,
      });
    }

    const numeroRps = `RPS-${Date.now()}`;
    const serieRps = 'A';

    // CLAIM ATÔMICO: INSERT com onConflictDoNothing materializa uq_notas_fiscais_pedido_viva.
    // Se nenhuma linha retorna → NF viva já existe → 409.
    // Catch de 23505 é segurança extra para corridas que passam pela tx sem conflito lógico.
    let notaFiscal: typeof notasFiscais.$inferSelect;
    try {
      notaFiscal = await this.db.transaction(async (tx) => {
        const [nf] = await tx.insert(notasFiscais).values({
          faturamentoId: faturamento.id,
          caminhaoId,
          pedidoVendaId: dto.pedidoVendaId,
          clienteId: pedidoRow.cliente.id,
          statusNfse: 'pendente',
          valor: dto.valor,
          aliquota: dto.aliquota ?? '0.0500',
          numeroRps,
          serieRps,
        })
          .onConflictDoNothing()
          .returning();
        if (!nf) throw new ConflictException('Pedido já possui NFS-e em emissão ou emitida');
        await this.auditoria.registrar(tx, {
          tabela: 'notas_fiscais', registroId: nf.id, operacao: 'INSERT',
          modulo: 'faturamento', usuarioId, dadosNovos: nf,
        });
        return nf;
      });
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      if ((e as { code?: string })?.code === '23505') {
        throw new ConflictException('Pedido já possui NFS-e em emissão ou emitida');
      }
      throw e;
    }

    // ── Fases B + C via métodos compartilhados ──────────────────────────────

    const homologacao = process.env['EISS_HOMOLOGACAO'] !== 'false';
    const chaveAutenticacao = homologacao
      ? (process.env['EISS_CHAVE_AUTENTICACAO_HML'] ?? '')
      : (process.env['EISS_CHAVE_AUTENTICACAO_PRD'] ?? '');

    const dadosFiscais = await this.buscarDadosFiscaisEmissao();
    const payloadBase = montarPayloadEiss(
      {
        pedidoId: dto.pedidoVendaId.slice(0, 8),
        cliente: {
          razaoSocial: pedidoRow.cliente.razaoSocial,
          documentoFiscal: pedidoRow.cliente.documentoFiscal,
          dadosFiscaisJson: pedidoRow.cliente.dadosFiscaisJson as Record<string, unknown>,
          dadosContatoJson: pedidoRow.cliente.dadosContatoJson as Record<string, unknown>,
        },
        itensDescricao: `${consolidacao.totalItens} item(ns)`,
        pesoTotalKg: (consolidacao.pedidos.find(p => p.pedidoVendaId === dto.pedidoVendaId)?.pesoTotalKg ?? 0).toFixed(3),
        valor: dto.valor,
      },
      dadosFiscais, homologacao, numeroRps, serieRps,
    );

    const gwResult = await this.serializarEmissao(() => this.chamarGateway(
      { ...payloadBase, chaveAutenticacao } as EmitirNfseRequest,
      homologacao,
    ));

    return this.persistirResultadoEmissao(
      notaFiscal.id, notaFiscal, gwResult,
      payloadBase as Record<string, unknown>,
      { caminhaoId, pedidoVendaId: dto.pedidoVendaId, dataOperacao: await this.dataOperacaoDoCaminhao(caminhao.operacaoId), usuarioId },
      dadosFiscais.modeloFiscal,
    );
  }

  /** Cancela uma NFS-e emitida. */
  async cancelar(notaFiscalId: string, dto: CancelarNfseDto, usuarioId: string) {
    const nf = await this.db.select().from(notasFiscais)
      .where(and(eq(notasFiscais.id, notaFiscalId), isNull(notasFiscais.deletedAt)))
      .then(r => r[0] ?? null);
    if (!nf) throw new ConflictException('Nota fiscal não encontrada');
    assertTransicaoNfse(nf.statusNfse as StatusNfse, 'cancelada');

    const caminhaoDaNota = await this.db.select({ statusCaminhao: caminhoes.statusCaminhao })
      .from(caminhoes).where(eq(caminhoes.id, nf.caminhaoId)).then((r) => r[0]);
    if (caminhaoDaNota && ['liberado_saida', 'expedido'].includes(caminhaoDaNota.statusCaminhao)) {
      throw new ConflictException({
        codigo: 'NOTA_TRAVADA_CAMINHAO_LIBERADO',
        message: 'Cancelamento bloqueado — caminhão já liberado',
      });
    }

    const caminhao = await this.db.select({ dataOperacao: operacoes.data })
      .from(caminhoes)
      .innerJoin(operacoes, eq(operacoes.id, caminhoes.operacaoId))
      .where(eq(caminhoes.id, nf.caminhaoId)).then(r => r[0]);

    const homologacao = process.env['EISS_HOMOLOGACAO'] !== 'false';
    const chaveAutenticacao = homologacao
      ? (process.env['EISS_CHAVE_AUTENTICACAO_HML'] ?? '')
      : (process.env['EISS_CHAVE_AUTENTICACAO_PRD'] ?? '');

    let resultadoCancelamento: NfseResultado;
    try {
      resultadoCancelamento = await this.gateway.cancelar({
        chaveAutenticacao, homologacao,
        numeroNota: nf.numeroNfse!,
        motivoCancelamento: dto.motivo,
      });
    } catch (e) {
      resultadoCancelamento = { erro: true, mensagemErro: (e as Error).message, raw: e };
    }

    const novoStatus: StatusNfse = resultadoCancelamento.erro ? 'erro_cancelamento' : 'cancelada';
    const payloadAuditoria = redigirSegredos({ response: resultadoCancelamento });

    const nfAtualizada = await this.db.transaction(async (tx) => {
      const [updated] = await tx.update(notasFiscais).set({
        statusNfse: novoStatus,
        canceladaEm: resultadoCancelamento.erro ? undefined : new Date(),
        motivoCancelamento: dto.motivo,
        ultimoErroNfse: resultadoCancelamento.erro ? resultadoCancelamento.mensagemErro : null,
        payloadEiss: payloadAuditoria as Record<string, unknown>,
      }).where(eq(notasFiscais.id, notaFiscalId)).returning();
      if (!updated) throw new Error('Falha ao atualizar nota fiscal');
      await this.auditoria.registrar(tx, {
        tabela: 'notas_fiscais', registroId: notaFiscalId, operacao: 'UPDATE',
        modulo: 'faturamento', usuarioId, dadosAnteriores: nf, dadosNovos: updated,
      });
      return updated;
    });

    if (!resultadoCancelamento.erro) {
      this.eventEmitter.emit(EVENTOS.NFSE_CANCELADA, {
        caminhaoId: nf.caminhaoId, notaFiscalId,
        dataOperacao: caminhao?.dataOperacao ?? '',
      });
      await this.liberacaoService.sincronizarPosEmissao(nf.caminhaoId, usuarioId);
    }

    return nfAtualizada;
  }

  /**
   * Reprocessa uma NF em erro_emissao: volta para pendente e tenta emissão novamente.
   * Opera na NF existente (não cria nova) — correto com o índice único parcial.
   * caminhaoId derivado da própria NF — o controller não precisa receber do cliente.
   */
  async reprocessar(notaFiscalId: string, usuarioId: string) {
    const nf = await this.db.select().from(notasFiscais)
      .where(and(eq(notasFiscais.id, notaFiscalId), isNull(notasFiscais.deletedAt)))
      .then(r => r[0] ?? null);
    if (!nf) throw new ConflictException('Nota fiscal não encontrada');
    assertTransicaoNfse(nf.statusNfse as StatusNfse, 'pendente');
    const caminhaoId = nf.caminhaoId;

    // Fase A (tx curta): voltar para pendente
    await this.db.transaction(async (tx) => {
      await tx.update(notasFiscais).set({
        statusNfse: 'pendente', ultimoErroNfse: null, tentativasEmissao: 0,
      }).where(eq(notasFiscais.id, notaFiscalId));
      await this.auditoria.registrar(tx, {
        tabela: 'notas_fiscais', registroId: notaFiscalId, operacao: 'UPDATE',
        modulo: 'faturamento', usuarioId,
        dadosAnteriores: nf,
        dadosNovos: { statusNfse: 'pendente', tentativasEmissao: 0 },
        justificativa: 'Reprocessamento manual',
      });
    });
    const nfPendente = {
      ...nf, statusNfse: 'pendente', ultimoErroNfse: null, tentativasEmissao: 0,
    } as typeof notasFiscais.$inferSelect;

    const caminhao = await this.db.select().from(caminhoes)
      .where(and(eq(caminhoes.id, caminhaoId), isNull(caminhoes.deletedAt)))
      .then(r => r[0] ?? null);
    if (!caminhao) throw new ConflictException('Caminhão não encontrado');

    const pedidoRow = await this.db.select({ pedido: pedidosVenda, cliente: clientes })
      .from(pedidosVenda)
      .innerJoin(clientes, eq(pedidosVenda.clienteId, clientes.id))
      .where(and(eq(pedidosVenda.id, nf.pedidoVendaId), isNull(pedidosVenda.deletedAt)))
      .then(r => r[0] ?? null);
    if (!pedidoRow) throw new ConflictException('Pedido não encontrado');

    const homologacao = process.env['EISS_HOMOLOGACAO'] !== 'false';
    const chaveAutenticacao = homologacao
      ? (process.env['EISS_CHAVE_AUTENTICACAO_HML'] ?? '')
      : (process.env['EISS_CHAVE_AUTENTICACAO_PRD'] ?? '');
    // numeroRps/serieRps foram setados na emissão original — serieRps tem DEFAULT 'A' no banco.
    const numeroRps = nf.numeroRps!;
    const serieRps = nf.serieRps ?? 'A';

    const dadosFiscais = await this.buscarDadosFiscaisEmissao();
    const payloadBase = montarPayloadEiss(
      {
        pedidoId: nf.pedidoVendaId.slice(0, 8),
        cliente: {
          razaoSocial: pedidoRow.cliente.razaoSocial,
          documentoFiscal: pedidoRow.cliente.documentoFiscal,
          dadosFiscaisJson: pedidoRow.cliente.dadosFiscaisJson as Record<string, unknown>,
          dadosContatoJson: pedidoRow.cliente.dadosContatoJson as Record<string, unknown>,
        },
        itensDescricao: 'reprocessamento',
        pesoTotalKg: '0.000',
        valor: String(nf.valor),
      },
      dadosFiscais, homologacao, numeroRps, serieRps,
    );

    // Fases B + C via métodos compartilhados (sem duplicação)
    const gwResult = await this.serializarEmissao(() => this.chamarGateway(
      { ...payloadBase, chaveAutenticacao } as EmitirNfseRequest,
      homologacao,
    ));

    return this.persistirResultadoEmissao(
      notaFiscalId, nfPendente, gwResult,
      payloadBase as Record<string, unknown>,
      { caminhaoId, pedidoVendaId: nf.pedidoVendaId, dataOperacao: await this.dataOperacaoDoCaminhao(caminhao.operacaoId), usuarioId },
      dadosFiscais.modeloFiscal,
    );
  }

  private async dataOperacaoDoCaminhao(operacaoId: string): Promise<string> {
    const linha = await this.db
      .select({ data: operacoes.data })
      .from(operacoes)
      .where(eq(operacoes.id, operacaoId))
      .then((r) => r[0] ?? null);
    return linha?.data ?? '';
  }

  /** Repasse fino ao gateway RTC — pesquisa NBS/ClassTrib por atividade (D10.2). */
  async rtcPesquisarNbs(atividade: string) {
    const homologacao = process.env['EISS_HOMOLOGACAO'] !== 'false';
    const chaveAutenticacao = homologacao
      ? (process.env['EISS_CHAVE_AUTENTICACAO_HML'] ?? '')
      : (process.env['EISS_CHAVE_AUTENTICACAO_PRD'] ?? '');
    return this.gateway.rtcPesquisarNbsClassTrib(chaveAutenticacao, homologacao, atividade);
  }
}
