import { ConflictException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { operacoes,
  caminhoes,
  cargaItens,
  faturamentos,
  notasFiscais,
  pecas,
  subitens,
  itensComerciais,
  pedidosVenda,
  clientes,
  auditoria,
  usuarios,
 } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { assertTransicao, type StatusCaminhao } from './transicoes';
import { CaminhaoService } from './caminhao.service';
import { LiberacaoChecklistService } from '../faturamento/liberacao-checklist.service';

type Tx = NodePgDatabase<typeof schema>;
type StatusFaturamento = 'em_consolidacao' | 'pronto_para_emitir' | 'parcialmente_emitido' | 'concluido';

@Injectable()
export class LiberacaoService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly caminhaoService: CaminhaoService,
    @Inject(forwardRef(() => LiberacaoChecklistService))
    private readonly checklistService: LiberacaoChecklistService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /** fechado → liberado_faturamento. Idempotente se já liberado ou além. */
  async liberarFaturamento(caminhaoId: string, operadorId: string) {
    const resultado = await this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, caminhaoId);
      const status = caminhao.statusCaminhao as StatusCaminhao;

      if (['liberado_faturamento', 'faturado', 'liberado_saida', 'expedido'].includes(status)) {
        return { caminhao, jaLiberado: true as const };
      }

      assertTransicao(status, 'liberado_faturamento');

      const atualizado = primeiroOuFalha(
        await tx
          .update(caminhoes)
          .set({ statusCaminhao: 'liberado_faturamento', horaLiberacao: new Date() })
          .where(eq(caminhoes.id, caminhaoId))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'caminhoes',
        registroId: caminhaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: caminhao,
        dadosNovos: atualizado,
        justificativa: 'Liberação para faturamento',
      });

      return { caminhao: atualizado, jaLiberado: false as const };
    });

    if (!resultado.jaLiberado) {
      const dataOperacao = await this.caminhaoService.dataOperacaoDoCaminhao(this.db, resultado.caminhao);
      this.eventEmitter.emit(EVENTOS.EXPEDICAO_LIBERADA_FATURAMENTO, {
        caminhaoId,
        dataOperacao,
      });
    }

    return resultado.caminhao;
  }

  /** faturado → liberado_saida. Exige checklist D10.6 liberável (guard RA-01) + faturamento concluído. */
  async liberarSaida(caminhaoId: string, operadorId: string) {
    const checklist = await this.checklistService.calcular(caminhaoId);
    if (!checklist.liberavel) {
      throw new ConflictException({
        codigo: 'CHECKLIST_INCOMPLETO',
        message: 'Liberação bloqueada — checklist incompleto',
        requisitos: checklist.requisitos.filter((r) => !r.ok),
      });
    }

    const resultado = await this.db.transaction(async (tx) => {
      const caminhao = await this.caminhaoService.caminhaoAtivo(tx, caminhaoId);
      const status = caminhao.statusCaminhao as StatusCaminhao;

      if (['liberado_saida', 'expedido'].includes(status)) {
        return { caminhao, jaLiberado: true as const };
      }

      assertTransicao(status, 'liberado_saida');

      const faturamento = await tx
        .select()
        .from(faturamentos)
        .where(and(eq(faturamentos.caminhaoId, caminhaoId), isNull(faturamentos.deletedAt)))
        .then((r) => r[0] ?? null);

      if (!faturamento || faturamento.statusFaturamento !== 'concluido') {
        throw new ConflictException(
          'Liberação de saída exige faturamento concluído (todas as NFS-e emitidas)',
        );
      }

      const atualizado = primeiroOuFalha(
        await tx
          .update(caminhoes)
          .set({ statusCaminhao: 'liberado_saida' })
          .where(eq(caminhoes.id, caminhaoId))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'caminhoes',
        registroId: caminhaoId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId: operadorId,
        dadosAnteriores: caminhao,
        dadosNovos: atualizado,
        justificativa: 'Liberação de saída na portaria',
      });

      return { caminhao: atualizado, jaLiberado: false as const };
    });

    if (!resultado.jaLiberado) {
      const dataOperacao = await this.caminhaoService.dataOperacaoDoCaminhao(this.db, resultado.caminhao);
      this.eventEmitter.emit(EVENTOS.EXPEDICAO_LIBERADA_SAIDA, { caminhaoId, dataOperacao });
      this.eventEmitter.emit(EVENTOS.CAMINHAO_LIBERADO, { caminhaoId, dataOperacao });
    }

    return resultado.caminhao;
  }

  /**
   * Atualiza statusFaturamento e caminhão após emissão/cancelamento de NFS-e.
   * Caminhão → faturado quando todos os pedidos da carga possuem NF emitida.
   */
  async sincronizarPosEmissao(caminhaoId: string, usuarioId: string, tx?: Tx) {
    const exec = tx ?? this.db;

    const faturamento = await exec
      .select()
      .from(faturamentos)
      .where(and(eq(faturamentos.caminhaoId, caminhaoId), isNull(faturamentos.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!faturamento) return null;

    const itensCarga = await exec
      .select({ pedidoVendaId: cargaItens.pedidoVendaId })
      .from(cargaItens)
      .where(
        and(
          eq(cargaItens.caminhaoId, caminhaoId),
          ne(cargaItens.statusCargaItem, 'removido'),
          isNull(cargaItens.deletedAt),
        ),
      );

    const pedidoIds = [...new Set(itensCarga.map((p) => p.pedidoVendaId))];
    if (pedidoIds.length === 0) return null;

    const nfs = await exec
      .select()
      .from(notasFiscais)
      .where(
        and(
          eq(notasFiscais.faturamentoId, faturamento.id),
          inArray(notasFiscais.pedidoVendaId, pedidoIds),
          isNull(notasFiscais.deletedAt),
        ),
      );

    const emitidas = nfs.filter((n) => n.statusNfse === 'emitida').length;
    const totalPedidos = pedidoIds.length;

    let novoStatusFat: StatusFaturamento;
    if (emitidas === 0) {
      novoStatusFat = faturamento.statusFaturamento === 'em_consolidacao'
        ? 'pronto_para_emitir'
        : faturamento.statusFaturamento as StatusFaturamento;
    } else if (emitidas < totalPedidos) {
      novoStatusFat = 'parcialmente_emitido';
    } else {
      novoStatusFat = 'concluido';
    }

    const caminhao = await this.caminhaoService.caminhaoAtivo(exec, caminhaoId);
    const statusAtual = caminhao.statusCaminhao as StatusCaminhao;
    let novoStatusCaminhao: StatusCaminhao | null = null;

    if (novoStatusFat === 'concluido') {
      if (statusAtual === 'fechado') {
        assertTransicao('fechado', 'liberado_faturamento');
        assertTransicao('liberado_faturamento', 'faturado');
        novoStatusCaminhao = 'faturado';
      } else if (statusAtual === 'liberado_faturamento') {
        assertTransicao(statusAtual, 'faturado');
        novoStatusCaminhao = 'faturado';
      }
    }

    const aplicar = async (innerTx: Tx) => {
      if (novoStatusFat !== faturamento.statusFaturamento) {
        const [fatAtualizado] = await innerTx
          .update(faturamentos)
          .set({ statusFaturamento: novoStatusFat })
          .where(eq(faturamentos.id, faturamento.id))
          .returning();
        if (fatAtualizado) {
          await this.auditoria.registrar(innerTx, {
            tabela: 'faturamentos',
            registroId: faturamento.id,
            operacao: 'UPDATE',
            modulo: 'faturamento',
            usuarioId,
            dadosAnteriores: faturamento,
            dadosNovos: fatAtualizado,
          });
        }
      }

      if (novoStatusCaminhao) {
        const [camAtualizado] = await innerTx
          .update(caminhoes)
          .set({ statusCaminhao: novoStatusCaminhao })
          .where(eq(caminhoes.id, caminhaoId))
          .returning();
        if (camAtualizado) {
          await this.auditoria.registrar(innerTx, {
            tabela: 'caminhoes',
            registroId: caminhaoId,
            operacao: 'UPDATE',
            modulo: 'faturamento',
            usuarioId,
            dadosAnteriores: caminhao,
            dadosNovos: camAtualizado,
          });
        }
      }

      return { statusFaturamento: novoStatusFat, statusCaminhao: novoStatusCaminhao ?? statusAtual };
    };

    if (tx) {
      return aplicar(tx);
    }

    return this.db.transaction(aplicar);
  }

  /**
   * Lista cargas em conferência/fechadas/liberadas/faturadas da data, com
   * agregados de clientes/peças/peso — D9.5 (tela "Enviar para Faturamento").
   */
  async listarParaEnvio(dataOperacao: string) {
    const caminhoesData = await this.db
      .select({
        id: caminhoes.id,
        placa: caminhoes.placa,
        motorista: caminhoes.motorista,
        rota: caminhoes.rota,
        statusCaminhao: caminhoes.statusCaminhao,
        horaLiberacao: caminhoes.horaLiberacao,
      })
      .from(caminhoes)
      .innerJoin(operacoes, eq(operacoes.id, caminhoes.operacaoId))
      .where(
        and(
          eq(operacoes.data, dataOperacao),
          isNull(caminhoes.deletedAt),
          sql`${caminhoes.statusCaminhao} IN ('em_conferencia', 'fechado', 'liberado_faturamento', 'faturado')`,
        ),
      )
      .orderBy(asc(caminhoes.createdAt));

    if (caminhoesData.length === 0) return [];

    const caminhaoIds = caminhoesData.map((c) => c.id);

    // Itens ativos das cargas, origem 'peca' — join peso/etiqueta/produto.
    const itensPeca = await this.db
      .select({
        caminhaoId: cargaItens.caminhaoId,
        pedidoVendaId: cargaItens.pedidoVendaId,
        etiqueta: pecas.etiquetaAtual,
        produtoNome: itensComerciais.descricao,
        peso: pecas.pesoOriginal,
      })
      .from(cargaItens)
      .innerJoin(pecas, eq(pecas.id, cargaItens.pecaId))
      .innerJoin(itensComerciais, eq(itensComerciais.id, pecas.itemComercialBaseId))
      .where(
        and(
          inArray(cargaItens.caminhaoId, caminhaoIds),
          eq(cargaItens.tipoOrigem, 'peca'),
          ne(cargaItens.statusCargaItem, 'removido'),
          isNull(cargaItens.deletedAt),
        ),
      );

    // Itens ativos das cargas, origem 'subitem' — join peso/etiqueta/produto.
    const itensSubitem = await this.db
      .select({
        caminhaoId: cargaItens.caminhaoId,
        pedidoVendaId: cargaItens.pedidoVendaId,
        etiqueta: subitens.etiquetaAtual,
        produtoNome: itensComerciais.descricao,
        peso: subitens.peso,
      })
      .from(cargaItens)
      .innerJoin(subitens, eq(subitens.id, cargaItens.subitemId))
      .innerJoin(itensComerciais, eq(itensComerciais.id, subitens.itemComercialId))
      .where(
        and(
          inArray(cargaItens.caminhaoId, caminhaoIds),
          eq(cargaItens.tipoOrigem, 'subitem'),
          ne(cargaItens.statusCargaItem, 'removido'),
          isNull(cargaItens.deletedAt),
        ),
      );

    const todosItens = [...itensPeca, ...itensSubitem];

    const pedidoIds = [...new Set(todosItens.map((i) => i.pedidoVendaId))];
    const pedidosData = pedidoIds.length
      ? await this.db
          .select({
            id: pedidosVenda.id,
            nomeFantasia: clientes.nomeFantasia,
            razaoSocial: clientes.razaoSocial,
          })
          .from(pedidosVenda)
          .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
          .where(inArray(pedidosVenda.id, pedidoIds))
      : [];
    const clienteNomePorPedido = new Map(
      pedidosData.map((p) => [p.id, p.nomeFantasia ?? p.razaoSocial]),
    );

    // Responsável pela liberação — auditoria da tabela caminhoes, justificativa fixa.
    const responsaveis = caminhaoIds.length
      ? await this.db
          .select({
            registroId: auditoria.registroId,
            responsavelNome: usuarios.nome,
          })
          .from(auditoria)
          .innerJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
          .where(
            and(
              eq(auditoria.tabela, 'caminhoes'),
              inArray(auditoria.registroId, caminhaoIds),
              eq(auditoria.justificativa, 'Liberação para faturamento'),
            ),
          )
      : [];
    const responsavelPorCaminhao = new Map(
      responsaveis.map((r) => [r.registroId, r.responsavelNome]),
    );

    return caminhoesData.map((caminhao) => {
      const itensDoCaminhao = todosItens.filter((i) => i.caminhaoId === caminhao.id);

      const pedidosMap = new Map<
        string,
        { pedidoVendaId: string; clienteNome: string | null; pecas: Array<{ etiqueta: string | null; produtoNome: string; peso: string }> }
      >();
      for (const item of itensDoCaminhao) {
        const existente = pedidosMap.get(item.pedidoVendaId) ?? {
          pedidoVendaId: item.pedidoVendaId,
          clienteNome: clienteNomePorPedido.get(item.pedidoVendaId) ?? null,
          pecas: [],
        };
        existente.pecas.push({
          etiqueta: item.etiqueta,
          produtoNome: item.produtoNome,
          peso: item.peso ?? '0',
        });
        pedidosMap.set(item.pedidoVendaId, existente);
      }

      const pedidosArr = [...pedidosMap.values()];
      const pesoTotal = itensDoCaminhao
        .reduce((acc, i) => acc + Number(i.peso ?? 0), 0)
        .toFixed(3);

      return {
        id: caminhao.id,
        placa: caminhao.placa,
        motorista: caminhao.motorista,
        rota: caminhao.rota,
        statusCaminhao: caminhao.statusCaminhao,
        pedidos: pedidosArr,
        totalClientes: pedidosArr.length,
        totalPecas: itensDoCaminhao.length,
        pesoTotal,
        envio: caminhao.horaLiberacao
          ? {
              dataHora: caminhao.horaLiberacao,
              responsavelNome: responsavelPorCaminhao.get(caminhao.id) ?? null,
            }
          : null,
      };
    });
  }

  /**
   * Lista caminhões elegíveis para liberação de saída (faturado), com dados de
   * quem/quando liberou (LiberacaoCaminhao.tsx:207 — banner "liberado por X em Y").
   * Liberação de saída não tem coluna própria — deriva de auditoria, mesmo padrão
   * já usado em `listarParaEnvio` para "Liberação para faturamento".
   */
  async listarParaLiberacao(dataOperacao: string) {
    const linhas = await this.db
      .select({
        id: caminhoes.id,
        placa: caminhoes.placa,
        motorista: caminhoes.motorista,
        rota: caminhoes.rota,
        statusCaminhao: caminhoes.statusCaminhao,
        dataOperacao: operacoes.data,
        statusFaturamento: faturamentos.statusFaturamento,
      })
      .from(caminhoes)
      .innerJoin(operacoes, eq(operacoes.id, caminhoes.operacaoId))
      .leftJoin(
        faturamentos,
        and(eq(faturamentos.caminhaoId, caminhoes.id), isNull(faturamentos.deletedAt)),
      )
      .where(
        and(
          eq(operacoes.data, dataOperacao),
          isNull(caminhoes.deletedAt),
          sql`${caminhoes.statusCaminhao} IN ('faturado', 'liberado_saida', 'liberado_faturamento', 'fechado')`,
        ),
      )
      .orderBy(asc(caminhoes.createdAt));

    const caminhoesLiberados = linhas.filter((l) => l.statusCaminhao === 'liberado_saida').map((l) => l.id);
    const registros = caminhoesLiberados.length
      ? await this.db
          .select({ registroId: auditoria.registroId, responsavelNome: usuarios.nome, dataHora: auditoria.createdAt })
          .from(auditoria)
          .innerJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
          .where(
            and(
              eq(auditoria.tabela, 'caminhoes'),
              inArray(auditoria.registroId, caminhoesLiberados),
              eq(auditoria.justificativa, 'Liberação de saída na portaria'),
            ),
          )
          .orderBy(desc(auditoria.createdAt))
      : [];
    const liberacaoPorCaminhao = new Map(
      registros.map((r) => [r.registroId, { dataHora: r.dataHora, responsavelNome: r.responsavelNome }]),
    );

    return linhas.map((linha) => ({
      ...linha,
      liberacaoSaida: liberacaoPorCaminhao.get(linha.id) ?? null,
    }));
  }
}
