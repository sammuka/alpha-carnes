import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { operacoes,
  caminhoes,
  cargaItens,
  faturamentos,
  notasFiscais,
 } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { EVENTOS } from '../../../realtime/events/eventos';
import { assertTransicao, type StatusCaminhao } from './transicoes';
import { CaminhaoService } from './caminhao.service';

type Tx = NodePgDatabase<typeof schema>;
type StatusFaturamento = 'em_consolidacao' | 'pronto_para_emitir' | 'parcialmente_emitido' | 'concluido';

@Injectable()
export class LiberacaoService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly caminhaoService: CaminhaoService,
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
          .set({ statusCaminhao: 'liberado_faturamento' })
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

  /** faturado → liberado_saida. Exige faturamento concluído (todas NFs emitidas). */
  async liberarSaida(caminhaoId: string, operadorId: string) {
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
      this.eventEmitter.emit(EVENTOS.EXPEDICAO_LIBERADA_SAIDA, {
        caminhaoId,
        dataOperacao: await this.caminhaoService.dataOperacaoDoCaminhao(this.db, resultado.caminhao),
      });
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

  /** Lista caminhões elegíveis para liberação de saída (faturado). */
  async listarParaLiberacao(dataOperacao: string) {
    return this.db
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
  }
}
