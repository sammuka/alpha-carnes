import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  notasFiscais,
  faturamentos,
  caminhoes,
  pedidosVenda,
  clientes,
  parametros,
} from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { NFSE_GATEWAY, type NfseGateway, NfseTransporteError } from '../../../integracoes/nfse/nfse.types';
import { montarPayloadEiss, redigirSegredos } from '../../../integracoes/nfse/payload-builder';
import { EVENTOS } from '../../../realtime/events/eventos';
import { assertTransicaoNfse, type StatusNfse } from './transicoes-nfse';
import type { EmitirNfseDto, CancelarNfseDto } from './dto/faturamento.dto';
import { ConsolidacaoService } from './consolidacao.service';

const RETRY_MAX = 3;
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000];

@Injectable()
export class FaturamentoService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    @Inject(NFSE_GATEWAY) private readonly gateway: NfseGateway,
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly consolidacaoService: ConsolidacaoService,
  ) {}

  private get db() { return this.drizzle.db; }

  /**
   * Emite NFS-e para um pedido dentro do faturamento de um caminhão.
   * Fluxo em 3 fases: claim atômico (tx curta) → gateway (fora de tx) → persistir resultado (tx curta).
   */
  async emitir(caminhaoId: string, dto: EmitirNfseDto, usuarioId: string) {
    // ── Fase A: Validações e claim atômico (tx curta → commit imediato) ─────────

    // Buscar faturamento ativo
    const faturamento = await this.db.select().from(faturamentos)
      .where(and(eq(faturamentos.caminhaoId, caminhaoId), isNull(faturamentos.deletedAt)))
      .then(r => r[0] ?? null);
    if (!faturamento) throw new ConflictException('Consolidação necessária antes de emitir');

    // Buscar caminhão e validar status
    const caminhao = await this.db.select().from(caminhoes)
      .where(and(eq(caminhoes.id, caminhaoId), isNull(caminhoes.deletedAt)))
      .then(r => r[0] ?? null);
    if (!caminhao) throw new ConflictException('Caminhão não encontrado');
    if (
      caminhao.statusCaminhao !== 'fechado' &&
      caminhao.statusCaminhao !== 'liberado_faturamento' &&
      caminhao.statusCaminhao !== 'parcialmente_emitido'
    ) {
      throw new ConflictException(`Emissão só para caminhão 'fechado'. Status: ${caminhao.statusCaminhao}`);
    }

    // Buscar dados do pedido e cliente
    const pedidoRow = await this.db.select({ pedido: pedidosVenda, cliente: clientes })
      .from(pedidosVenda)
      .innerJoin(clientes, eq(pedidosVenda.clienteId, clientes.id))
      .where(and(eq(pedidosVenda.id, dto.pedidoVendaId), isNull(pedidosVenda.deletedAt)))
      .then(r => r[0] ?? null);
    if (!pedidoRow) throw new ConflictException('Pedido não encontrado');

    // Revalidar bloqueios críticos
    const consolidacao = await this.consolidacaoService.consolidar(caminhaoId, usuarioId);
    if (consolidacao.bloqueios.length > 0) {
      throw new ConflictException({
        message: 'Emissão bloqueada por pendências críticas',
        bloqueios: consolidacao.bloqueios,
      });
    }

    // Buscar dados do prestador (parametros ou env)
    const paramPrestador = await this.db.select().from(parametros)
      .where(eq(parametros.chave, 'empresa_dados_fiscais'))
      .then(r => r[0] ?? null);
    const prestadorJson = (paramPrestador?.valorJson ?? {}) as Record<string, string>;
    const prestador = {
      razaoSocial: prestadorJson['razao_social'] ?? process.env['EISS_RAZAO_SOCIAL'] ?? 'AlphaCarnes',
      cnpj: prestadorJson['cnpj'] ?? process.env['EISS_CNPJ_PRESTADOR'] ?? '',
      inscricaoMunicipal: prestadorJson['inscricao_municipal'] ?? process.env['EISS_INSCRICAO_MUNICIPAL'] ?? '',
      email: prestadorJson['email'],
    };

    // Gerar numeroRps
    const numeroRps = `RPS-${Date.now()}`;
    const serieRps = 'A';

    // CLAIM ATÔMICO: inserir NF pendente — materializa o índice único parcial
    // ON CONFLICT com uq_notas_fiscais_pedido_viva → nenhuma linha retorna → 409
    let notaFiscal: typeof notasFiscais.$inferSelect;
    try {
      const resultado = await this.db.transaction(async (tx) => {
        const [nf] = await tx.insert(notasFiscais).values({
          faturamentoId: faturamento.id,
          caminhaoId,
          pedidoVendaId: dto.pedidoVendaId,
          clienteId: pedidoRow.cliente.id,
          statusNfse: 'pendente',
          valor: dto.valor,
          aliquota: dto.aliquota ?? '0.0500',
          codigoServico: dto.codigoServico ?? null,
          numeroRps,
          serieRps,
        } as typeof notasFiscais.$inferInsert)
          .onConflictDoNothing()
          .returning();

        if (!nf) {
          // Já existe NF viva para este pedido
          throw new ConflictException('Pedido já possui NFS-e em emissão ou emitida');
        }

        await this.auditoria.registrar(tx, {
          tabela: 'notas_fiscais',
          registroId: nf.id,
          operacao: 'INSERT',
          modulo: 'faturamento',
          usuarioId,
          dadosNovos: nf,
        });

        return nf;
      });
      notaFiscal = resultado;
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      // Violação de unique (pg error code 23505) — NF viva já existe
      if ((e as { code?: string })?.code === '23505') {
        throw new ConflictException('Pedido já possui NFS-e em emissão ou emitida');
      }
      throw e;
    }

    // ── Fase B: Gateway + retry FORA de qualquer transação ──────────────────────

    const homologacao = process.env['EISS_HOMOLOGACAO'] !== 'false';
    const chaveAutenticacao = homologacao
      ? (process.env['EISS_CHAVE_AUTENTICACAO_HML'] ?? '')
      : (process.env['EISS_CHAVE_AUTENTICACAO_PRD'] ?? '');

    const pedidoParaPayload = {
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
      aliquota: dto.aliquota,
      codigoServico: dto.codigoServico,
    };

    const payloadBase = montarPayloadEiss(pedidoParaPayload, prestador, homologacao, numeroRps, serieRps);
    const reqGateway = { ...payloadBase, chaveAutenticacao };

    let tentativas = 0;
    let resultado: Awaited<ReturnType<NfseGateway['emitir']>> | null = null;
    let erroFinal: Error | null = null;

    while (tentativas < RETRY_MAX) {
      try {
        const res = await this.gateway.emitir(reqGateway);

        if (!res.erro) {
          // Sucesso real
          resultado = res;
          break;
        } else {
          // Erro de negócio EISS (Erro=true) — não-retriável
          erroFinal = new Error(res.mensagemErro ?? 'Erro de negócio EISS');
          resultado = res;
          break;
        }
      } catch (e) {
        if (e instanceof NfseTransporteError) {
          tentativas++;

          // Em timeout, consultar antes de retransmitir (anti-nota-fantasma)
          if (tentativas >= 1 && e.message.toLowerCase().includes('timeout')) {
            try {
              const consulta = await this.gateway.consultarNotaCompleta({
                chaveAutenticacao,
                homologacao,
                numeroRps,
                serieRps,
                prestador: { nome: prestador.razaoSocial, cnpj: prestador.cnpj.replace(/\D/g, '') },
              });
              if (!consulta.erro && consulta.numeroNota) {
                // Nota foi emitida mas resposta não chegou — capturar sem duplicar
                resultado = consulta;
                tentativas = RETRY_MAX; // sair do loop
                break;
              }
            } catch {
              // Consulta falhou também — seguir para retry
            }
          }

          if (tentativas < RETRY_MAX) {
            const delay = parseInt(
              process.env['EISS_RETRY_DELAY_MS'] ?? String(RETRY_DELAYS_MS[tentativas - 1] ?? 5000),
              10,
            );
            await new Promise(r => setTimeout(r, delay));
          } else {
            erroFinal = e;
          }
        } else {
          erroFinal = e as Error;
          break;
        }
      }
    }

    // ── Fase C: Persistir resultado (tx curta) + evento após commit ─────────────

    const payloadAuditoria = redigirSegredos({ request: reqGateway, response: resultado ?? erroFinal?.message });

    let notaAtualizada: typeof notasFiscais.$inferSelect;

    if (resultado && !resultado.erro) {
      // Emissão bem-sucedida
      assertTransicaoNfse('pendente', 'emitida');
      notaAtualizada = await this.db.transaction(async (tx) => {
        const [nf] = await tx.update(notasFiscais).set({
          statusNfse: 'emitida',
          numeroNfse: resultado!.numeroNota ?? null,
          codigoVerificacao: resultado!.codigoVerificacao ?? null,
          linkNfse: resultado!.linkNota ?? null,
          emitidaEm: new Date(),
          tentativasEmissao: tentativas,
          payloadEiss: payloadAuditoria as Record<string, unknown>,
        }).where(eq(notasFiscais.id, notaFiscal.id)).returning();
        if (!nf) throw new Error('Falha ao atualizar nota fiscal');

        await this.auditoria.registrar(tx, {
          tabela: 'notas_fiscais',
          registroId: nf.id,
          operacao: 'UPDATE',
          modulo: 'faturamento',
          usuarioId,
          dadosAnteriores: notaFiscal,
          dadosNovos: nf,
        });

        return nf;
      });

      this.eventEmitter.emit(EVENTOS.NFSE_EMITIDA, {
        caminhaoId,
        notaFiscalId: notaAtualizada.id,
        pedidoVendaId: dto.pedidoVendaId,
        numeroNfse: notaAtualizada.numeroNfse,
        dataOperacao: caminhao.dataOperacao,
      });
    } else {
      // Erro (negócio ou transporte esgotado)
      assertTransicaoNfse('pendente', 'erro_emissao');
      const mensagemErro = resultado?.mensagemErro ?? erroFinal?.message ?? 'Erro desconhecido';
      notaAtualizada = await this.db.transaction(async (tx) => {
        const [nf] = await tx.update(notasFiscais).set({
          statusNfse: 'erro_emissao',
          ultimoErroNfse: mensagemErro,
          tentativasEmissao: tentativas,
          payloadEiss: payloadAuditoria as Record<string, unknown>,
        }).where(eq(notasFiscais.id, notaFiscal.id)).returning();
        if (!nf) throw new Error('Falha ao atualizar nota fiscal');

        await this.auditoria.registrar(tx, {
          tabela: 'notas_fiscais',
          registroId: nf.id,
          operacao: 'UPDATE',
          modulo: 'faturamento',
          usuarioId,
          dadosAnteriores: notaFiscal,
          dadosNovos: nf,
        });

        return nf;
      });

      this.eventEmitter.emit(EVENTOS.NFSE_ERRO_EMISSAO, {
        caminhaoId,
        notaFiscalId: notaAtualizada.id,
        pedidoVendaId: dto.pedidoVendaId,
        ultimoErro: mensagemErro,
        tentativas,
        dataOperacao: caminhao.dataOperacao,
      });
    }

    return notaAtualizada;
  }

  /** Cancela uma NFS-e emitida. */
  async cancelar(notaFiscalId: string, dto: CancelarNfseDto, usuarioId: string) {
    const nf = await this.db.select().from(notasFiscais)
      .where(and(eq(notasFiscais.id, notaFiscalId), isNull(notasFiscais.deletedAt)))
      .then(r => r[0] ?? null);
    if (!nf) throw new ConflictException('Nota fiscal não encontrada');
    assertTransicaoNfse(nf.statusNfse as StatusNfse, 'cancelada');

    const caminhao = await this.db.select({ dataOperacao: caminhoes.dataOperacao })
      .from(caminhoes).where(eq(caminhoes.id, nf.caminhaoId)).then(r => r[0]);

    const homologacao = process.env['EISS_HOMOLOGACAO'] !== 'false';
    const chaveAutenticacao = homologacao
      ? (process.env['EISS_CHAVE_AUTENTICACAO_HML'] ?? '')
      : (process.env['EISS_CHAVE_AUTENTICACAO_PRD'] ?? '');

    const paramPrestador = await this.db.select().from(parametros)
      .where(eq(parametros.chave, 'empresa_dados_fiscais')).then(r => r[0] ?? null);
    const prestadorJson = (paramPrestador?.valorJson ?? {}) as Record<string, string>;

    let resultadoCancelamento: Awaited<ReturnType<NfseGateway['cancelar']>>;
    try {
      resultadoCancelamento = await this.gateway.cancelar({
        chaveAutenticacao,
        homologacao,
        numeroNota: nf.numeroNfse!,
        motivoCancelamento: dto.motivo,
        prestador: {
          nome: prestadorJson['razao_social'] ?? 'AlphaCarnes',
          cnpj: (prestadorJson['cnpj'] ?? '').replace(/\D/g, ''),
          inscricaoMunicipal: prestadorJson['inscricao_municipal'],
        },
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
        tabela: 'notas_fiscais',
        registroId: notaFiscalId,
        operacao: 'UPDATE',
        modulo: 'faturamento',
        usuarioId,
        dadosAnteriores: nf,
        dadosNovos: updated,
      });

      return updated;
    });

    if (!resultadoCancelamento.erro) {
      this.eventEmitter.emit(EVENTOS.NFSE_CANCELADA, {
        caminhaoId: nf.caminhaoId,
        notaFiscalId,
        dataOperacao: caminhao?.dataOperacao ?? '',
      });
    }

    return nfAtualizada;
  }

  /**
   * Reprocessa uma NF em erro_emissao: volta para pendente e tenta emissão novamente.
   * Opera diretamente na NF existente (não cria nova) — correto com o índice único parcial.
   */
  async reprocessar(notaFiscalId: string, caminhaoId: string, usuarioId: string) {
    const nf = await this.db.select().from(notasFiscais)
      .where(and(eq(notasFiscais.id, notaFiscalId), isNull(notasFiscais.deletedAt)))
      .then(r => r[0] ?? null);
    if (!nf) throw new ConflictException('Nota fiscal não encontrada');
    assertTransicaoNfse(nf.statusNfse as StatusNfse, 'pendente');

    // Fase A (tx curta): voltar para pendente — marca a NF para reprocessamento
    await this.db.transaction(async (tx) => {
      await tx.update(notasFiscais).set({
        statusNfse: 'pendente',
        ultimoErroNfse: null,
        tentativasEmissao: 0,
      }).where(eq(notasFiscais.id, notaFiscalId));

      await this.auditoria.registrar(tx, {
        tabela: 'notas_fiscais',
        registroId: notaFiscalId,
        operacao: 'UPDATE',
        modulo: 'faturamento',
        usuarioId,
        dadosAnteriores: nf,
        dadosNovos: { statusNfse: 'pendente', tentativasEmissao: 0 },
        justificativa: 'Reprocessamento manual',
      });
    });

    // Buscar dados necessários para a emissão
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

    const paramPrestador = await this.db.select().from(parametros)
      .where(eq(parametros.chave, 'empresa_dados_fiscais')).then(r => r[0] ?? null);
    const prestadorJson = (paramPrestador?.valorJson ?? {}) as Record<string, string>;
    const prestador = {
      razaoSocial: prestadorJson['razao_social'] ?? process.env.EISS_RAZAO_SOCIAL ?? 'AlphaCarnes',
      cnpj: prestadorJson['cnpj'] ?? process.env.EISS_CNPJ_PRESTADOR ?? '',
      inscricaoMunicipal: prestadorJson['inscricao_municipal'] ?? process.env.EISS_INSCRICAO_MUNICIPAL ?? '',
      email: prestadorJson['email'],
    };

    const homologacao = process.env.EISS_HOMOLOGACAO !== 'false';
    const chaveAutenticacao = homologacao
      ? (process.env.EISS_CHAVE_AUTENTICACAO_HML ?? '')
      : (process.env.EISS_CHAVE_AUTENTICACAO_PRD ?? '');

    const numeroRps = nf.numeroRps ?? `RPS-${Date.now()}`;
    const serieRps = nf.serieRps ?? 'A';

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
        aliquota: String(nf.aliquota),
      },
      prestador,
      homologacao,
      numeroRps,
      serieRps,
    );
    const reqGateway = { ...payloadBase, chaveAutenticacao };

    // Fase B: gateway + retry FORA de qualquer transação (igual ao emitir)
    let tentativas = 0;
    let resultado: Awaited<ReturnType<NfseGateway['emitir']>> | null = null;
    let erroFinal: Error | null = null;

    while (tentativas < RETRY_MAX) {
      try {
        const res = await this.gateway.emitir(reqGateway);
        if (!res.erro) { resultado = res; break; }
        else { erroFinal = new Error(res.mensagemErro ?? 'Erro de negócio EISS'); resultado = res; break; }
      } catch (e) {
        if (e instanceof NfseTransporteError) {
          tentativas++;
          if (tentativas >= 1 && e.message.toLowerCase().includes('timeout')) {
            try {
              const consulta = await this.gateway.consultarNotaCompleta({
                chaveAutenticacao, homologacao, numeroRps, serieRps,
                prestador: { nome: prestador.razaoSocial, cnpj: prestador.cnpj.replace(/\D/g, '') },
              });
              if (!consulta.erro && consulta.numeroNota) { resultado = consulta; tentativas = RETRY_MAX; break; }
            } catch { /* seguir retry */ }
          }
          if (tentativas < RETRY_MAX) {
            const delay = parseInt(process.env.EISS_RETRY_DELAY_MS ?? String(RETRY_DELAYS_MS[tentativas - 1] ?? 5000));
            await new Promise(r => setTimeout(r, delay));
          } else { erroFinal = e; }
        } else { erroFinal = e as Error; break; }
      }
    }

    // Fase C: persistir resultado na NF existente (tx curta)
    const payloadAuditoria = redigirSegredos({ request: reqGateway, response: resultado ?? erroFinal?.message });

    let notaAtualizada: typeof notasFiscais.$inferSelect;
    if (resultado && !resultado.erro) {
      notaAtualizada = await this.db.transaction(async (tx) => {
        const [updated] = await tx.update(notasFiscais).set({
          statusNfse: 'emitida',
          numeroNfse: resultado!.numeroNota,
          codigoVerificacao: resultado!.codigoVerificacao,
          linkNfse: resultado!.linkNota ?? null,
          emitidaEm: new Date(),
          tentativasEmissao: tentativas,
          payloadEiss: payloadAuditoria as Record<string, unknown>,
        }).where(eq(notasFiscais.id, notaFiscalId)).returning();
        if (!updated) throw new Error('Falha ao atualizar nota fiscal');
        await this.auditoria.registrar(tx, {
          tabela: 'notas_fiscais', registroId: notaFiscalId, operacao: 'UPDATE',
          modulo: 'faturamento', usuarioId, dadosAnteriores: nf, dadosNovos: updated,
        });
        return updated;
      });
      this.eventEmitter.emit(EVENTOS.NFSE_EMITIDA, {
        caminhaoId, notaFiscalId, pedidoVendaId: nf.pedidoVendaId,
        numeroNfse: notaAtualizada.numeroNfse, dataOperacao: caminhao.dataOperacao,
      });
    } else {
      const mensagemErro = resultado?.mensagemErro ?? erroFinal?.message ?? 'Erro desconhecido';
      notaAtualizada = await this.db.transaction(async (tx) => {
        const [updated] = await tx.update(notasFiscais).set({
          statusNfse: 'erro_emissao', ultimoErroNfse: mensagemErro,
          tentativasEmissao: tentativas, payloadEiss: payloadAuditoria as Record<string, unknown>,
        }).where(eq(notasFiscais.id, notaFiscalId)).returning();
        if (!updated) throw new Error('Falha ao atualizar nota fiscal');
        await this.auditoria.registrar(tx, {
          tabela: 'notas_fiscais', registroId: notaFiscalId, operacao: 'UPDATE',
          modulo: 'faturamento', usuarioId, dadosAnteriores: nf, dadosNovos: updated,
        });
        return updated;
      });
      this.eventEmitter.emit(EVENTOS.NFSE_ERRO_EMISSAO, {
        caminhaoId, notaFiscalId, pedidoVendaId: nf.pedidoVendaId,
        ultimoErro: mensagemErro, tentativas, dataOperacao: caminhao.dataOperacao,
      });
    }

    return notaAtualizada;
  }
}
