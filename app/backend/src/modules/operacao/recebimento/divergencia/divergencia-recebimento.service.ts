import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  pedidosFornecedor,
  operacoes,
  divergenciasRecebimento,
  recebimentos,
  recebimentosItens,
} from '../../../../database/schema';
import { AuditoriaService } from '../../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../../common/crud/paginacao';
import { EVENTOS } from '../../../../realtime/events/eventos';
import { OcorrenciaFornecedorService } from '../ocorrencia/ocorrencia-fornecedor.service';
import type { DivergenciaInput, AtualizarDivergenciaDto } from './dto/divergencia-recebimento.dto';

type Tx = NodePgDatabase<typeof schema>;
type Divergencia = typeof divergenciasRecebimento.$inferSelect;

interface AbrirNaTxParams extends DivergenciaInput {
  recebimentoId: string;
  recebimentoItemId: string;
}

@Injectable()
export class DivergenciaRecebimentoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly ocorrencias: OcorrenciaFornecedorService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  /** Abre a divergência DENTRO da transação do registrar item (status 'aberta'). */
  async abrirNaTx(tx: Tx, params: AbrirNaTxParams, usuarioId: string): Promise<Divergencia> {
    const item = await tx
      .select({ itemComercialId: recebimentosItens.itemComercialId })
      .from(recebimentosItens)
      .where(eq(recebimentosItens.id, params.recebimentoItemId))
      .then((r) => r[0] ?? null);
    if (!item) throw new NotFoundException('Item de recebimento não encontrado');

    const criada = primeiroOuFalha(
      await tx
        .insert(divergenciasRecebimento)
        .values({
          recebimentoId: params.recebimentoId,
          recebimentoItemId: params.recebimentoItemId,
          itemComercialId: item.itemComercialId,
          tipo: params.tipo,
          descricao: params.descricao,
          acaoImediata: params.acaoImediata,
          impactoOperacional: params.impactoOperacional,
          impactoComercial: params.impactoComercial,
          responsavelRegistroId: usuarioId,
          status: 'aberta',
        })
        .returning(),
    );

    await this.auditoria.registrar(tx, {
      tabela: 'divergencias_recebimento',
      registroId: criada.id,
      operacao: 'INSERT',
      modulo: 'operacao',
      usuarioId,
      dadosAnteriores: {},
      dadosNovos: criada,
    });

    return criada;
  }

  /** Conta divergências do recebimento ainda 'aberta' (sem tratativa registrada). */
  async contarAbertasSemTratativa(tx: Tx, recebimentoId: string): Promise<number> {
    const linha = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(divergenciasRecebimento)
      .where(and(eq(divergenciasRecebimento.recebimentoId, recebimentoId), eq(divergenciasRecebimento.status, 'aberta')))
      .then((r) => r[0] ?? null);
    return linha?.total ?? 0;
  }

  /**
   * Transição auditada da divergência (a tratativa que libera a conclusão). Mover
   * para 'aguardando_fornecedor' abre e vincula uma ocorrência com fornecedor na
   * mesma transação. Eventos emitidos pós-commit.
   */
  async atualizar(divergenciaId: string, dto: AtualizarDivergenciaDto, usuarioId: string): Promise<Divergencia> {
    const resultado = await this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(divergenciasRecebimento)
        .where(eq(divergenciasRecebimento.id, divergenciaId))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Divergência não encontrada');
      if (anterior.status === 'resolvida') throw new ConflictException('Divergência já resolvida');

      const novoStatus = dto.status ?? anterior.status;
      const atualizada = primeiroOuFalha(
        await tx
          .update(divergenciasRecebimento)
          .set({
            status: novoStatus,
            impactoOperacional: dto.impactoOperacional ?? anterior.impactoOperacional,
            impactoComercial: dto.impactoComercial ?? anterior.impactoComercial,
            acaoImediata: dto.acaoImediata ?? anterior.acaoImediata,
          })
          .where(eq(divergenciasRecebimento.id, divergenciaId))
          .returning(),
      );

      const dataOperacao = await this.resolverDataOperacao(tx, atualizada.recebimentoId);

      // Ao aguardar o fornecedor, abre/vincula ocorrência (se ainda não houver).
      let ocorrenciaAberta: { id: string; fornecedorId: string } | null = null;
      if (novoStatus === 'aguardando_fornecedor') {
        const jaTem = await tx
          .select({ id: schema.ocorrenciasFornecedor.id })
          .from(schema.ocorrenciasFornecedor)
          .where(eq(schema.ocorrenciasFornecedor.divergenciaId, divergenciaId))
          .then((r) => r[0] ?? null);
        if (!jaTem) {
          const recebimento = await tx
            .select({
              fornecedorId: recebimentos.fornecedorId,
              compraId: pedidosFornecedor.compraProgramadaId,
            })
            .from(recebimentos)
            .innerJoin(pedidosFornecedor, eq(pedidosFornecedor.id, recebimentos.pedidoFornecedorId))
            .where(eq(recebimentos.id, atualizada.recebimentoId))
            .then((r) => r[0] ?? null);
          if (recebimento) {
            const ocorrencia = await this.ocorrencias.abrirNaTx(
              tx,
              {
                fornecedorId: recebimento.fornecedorId,
                compraProgramadaId: recebimento.compraId,
                divergenciaId,
                descricao: `Divergência ${atualizada.tipo}: ${atualizada.descricao}`,
                impacto: atualizada.impactoOperacional ?? undefined,
              },
              usuarioId,
            );
            ocorrenciaAberta = { id: ocorrencia.id, fornecedorId: ocorrencia.fornecedorId };
          }
        }
      }

      await this.auditoria.registrar(tx, {
        tabela: 'divergencias_recebimento',
        registroId: divergenciaId,
        operacao: 'UPDATE',
        modulo: 'operacao',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizada,
      });

      return { divergencia: atualizada, dataOperacao, ocorrenciaAberta };
    });

    // PÓS-COMMIT: atualização da divergência (+ abertura da ocorrência, se houve).
    this.eventEmitter.emit(EVENTOS.DIVERGENCIA_RECEBIMENTO_ATUALIZADA, {
      divergenciaId: resultado.divergencia.id,
      recebimentoId: resultado.divergencia.recebimentoId,
      dataOperacao: resultado.dataOperacao,
      tipo: resultado.divergencia.tipo,
      status: resultado.divergencia.status,
    });
    if (resultado.ocorrenciaAberta) {
      this.eventEmitter.emit(EVENTOS.OCORRENCIA_FORNECEDOR_ABERTA, {
        ocorrenciaId: resultado.ocorrenciaAberta.id,
        fornecedorId: resultado.ocorrenciaAberta.fornecedorId,
        dataOperacao: resultado.dataOperacao,
        status: 'aberta',
      });
    }

    return resultado.divergencia;
  }

  private async resolverDataOperacao(tx: Tx, recebimentoId: string): Promise<string> {
    const linha = await tx
      .select({ dataOperacao: operacoes.data })
      .from(recebimentos)
      .innerJoin(operacoes, eq(operacoes.id, recebimentos.operacaoId))
      .where(eq(recebimentos.id, recebimentoId))
      .then((r) => r[0] ?? null);
    return linha?.dataOperacao ?? '';
  }
}
