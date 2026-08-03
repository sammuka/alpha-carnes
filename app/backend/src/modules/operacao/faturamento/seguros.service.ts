import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { segurosCarga, caminhoes, operacoes } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { primeiroOuFalha } from '../../../common/crud/paginacao';
import { montarPaginado, calcularRange, type ListarSegurosQuery } from './dto/faturamento.dto';
import { EVENTOS } from '../../../realtime/events/eventos';
import { assertTransicaoSeguro, type StatusSeguro } from './transicoes-seguro';

@Injectable()
export class SegurosService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  private get db() { return this.drizzle.db; }

  /** Listagem com dados do caminhão/carga + notas vinculadas. */
  async listar(query: ListarSegurosQuery) {
    const condicoes = [isNull(segurosCarga.deletedAt)];
    if (query.status) condicoes.push(eq(segurosCarga.status, query.status));
    if (query.busca) {
      const termo = `%${query.busca}%`;
      condicoes.push(or(ilike(caminhoes.placa, termo), ilike(caminhoes.motorista, termo))!);
    }
    const { limit, offset } = calcularRange(query);
    const base = this.db.select({ seguro: segurosCarga, caminhao: caminhoes })
      .from(segurosCarga).innerJoin(caminhoes, eq(caminhoes.id, segurosCarga.caminhaoId))
      .where(and(...condicoes));

    const [linhas, totalRow] = await Promise.all([
      base.orderBy(desc(segurosCarga.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(segurosCarga)
        .innerJoin(caminhoes, eq(caminhoes.id, segurosCarga.caminhaoId)).where(and(...condicoes)),
    ]);
    return montarPaginado(linhas.map((l) => ({ ...l.seguro, caminhao: l.caminhao })), totalRow[0]?.total ?? 0, query);
  }

  /** Cria (lazy, idempotente por caminhaoId) ou retorna o seguro vivo do caminhão. */
  async obterOuCriar(caminhaoId: string, usuarioId: string) {
    const existente = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.caminhaoId, caminhaoId), isNull(segurosCarga.deletedAt)))
      .then((r) => r[0] ?? null);
    if (existente) return existente;

    const caminhao = await this.db.select().from(caminhoes)
      .where(and(eq(caminhoes.id, caminhaoId), isNull(caminhoes.deletedAt))).then((r) => r[0] ?? null);
    if (!caminhao) throw new NotFoundException('Caminhão não encontrado');

    try {
      return await this.db.transaction(async (tx) => {
        const [seguro] = await tx.insert(segurosCarga).values({ caminhaoId, status: 'pendente' })
          .onConflictDoNothing().returning();
        if (!seguro) throw new ConflictException('Seguro já existe para este caminhão');
        await this.auditoria.registrar(tx, {
          tabela: 'seguros_carga', registroId: seguro.id, operacao: 'INSERT',
          modulo: 'faturamento', usuarioId, dadosNovos: seguro,
        });
        return seguro;
      });
    } catch (e) {
      if ((e as { code?: string })?.code === '23505') {
        return primeiroOuFalha(
          await this.db.select().from(segurosCarga)
            .where(and(eq(segurosCarga.caminhaoId, caminhaoId), isNull(segurosCarga.deletedAt))),
        );
      }
      throw e;
    }
  }

  /** Transição de status (D10.5) — 409 TRANSICAO_SEGURO_INVALIDA se fora do grafo. */
  async alterarStatus(seguroId: string, novoStatus: StatusSeguro, usuarioId: string) {
    const seguro = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.id, seguroId), isNull(segurosCarga.deletedAt))).then((r) => r[0] ?? null);
    if (!seguro) throw new NotFoundException('Seguro não encontrado');

    try {
      assertTransicaoSeguro(seguro.status as StatusSeguro, novoStatus);
    } catch {
      throw new ConflictException({ codigo: 'TRANSICAO_SEGURO_INVALIDA', message: `Transição inválida: ${seguro.status} → ${novoStatus}` });
    }

    const patch: Partial<typeof segurosCarga.$inferInsert> = { status: novoStatus };
    if (novoStatus === 'enviado') { patch.enviadoEm = new Date(); patch.responsavelId = usuarioId; }
    if (novoStatus === 'confirmado') { patch.confirmadoEm = new Date(); }
    if (novoStatus === 'pendente') { patch.enviadoEm = null; }

    const atualizado = await this.db.transaction(async (tx) => {
      const [row] = await tx.update(segurosCarga).set(patch).where(eq(segurosCarga.id, seguroId)).returning();
      if (!row) throw new Error('Falha ao atualizar seguro');
      await this.auditoria.registrar(tx, {
        tabela: 'seguros_carga', registroId: seguroId, operacao: 'UPDATE',
        modulo: 'faturamento', usuarioId, dadosAnteriores: seguro, dadosNovos: row,
      });
      return row;
    });

    const dataOperacao = await this.db.select({ data: operacoes.data }).from(operacoes)
      .innerJoin(caminhoes, eq(caminhoes.operacaoId, operacoes.id))
      .where(eq(caminhoes.id, seguro.caminhaoId)).then((r) => r[0]?.data ?? '');
    this.eventEmitter.emit(EVENTOS.SEGURO_ATUALIZADO, {
      caminhaoId: seguro.caminhaoId, seguroId, status: novoStatus, dataOperacao,
    });

    return atualizado;
  }

  /** Anexo referencial (P-Onda10.1 — nome/descrição, sem upload físico). */
  async registrarAnexo(seguroId: string, nome: string, descricao: string | undefined, usuarioId: string) {
    const seguro = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.id, seguroId), isNull(segurosCarga.deletedAt))).then((r) => r[0] ?? null);
    if (!seguro) throw new NotFoundException('Seguro não encontrado');

    const anexos = [...(seguro.anexosJson as unknown[]), { nome, descricao, registradoEm: new Date().toISOString(), registradoPor: usuarioId }];
    return this.db.transaction(async (tx) => {
      const [row] = await tx.update(segurosCarga).set({ anexosJson: anexos }).where(eq(segurosCarga.id, seguroId)).returning();
      if (!row) throw new Error('Falha ao registrar anexo');
      await this.auditoria.registrar(tx, {
        tabela: 'seguros_carga', registroId: seguroId, operacao: 'UPDATE',
        modulo: 'faturamento', usuarioId, dadosAnteriores: seguro, dadosNovos: row,
      });
      return row;
    });
  }

  /** Observação editável (sem regra de transição — texto livre). */
  async salvarObservacao(seguroId: string, observacao: string, usuarioId: string) {
    const seguro = await this.db.select().from(segurosCarga)
      .where(and(eq(segurosCarga.id, seguroId), isNull(segurosCarga.deletedAt))).then((r) => r[0] ?? null);
    if (!seguro) throw new NotFoundException('Seguro não encontrado');
    return this.db.transaction(async (tx) => {
      const [row] = await tx.update(segurosCarga).set({ observacao }).where(eq(segurosCarga.id, seguroId)).returning();
      if (!row) throw new Error('Falha ao salvar observação');
      await this.auditoria.registrar(tx, {
        tabela: 'seguros_carga', registroId: seguroId, operacao: 'UPDATE',
        modulo: 'faturamento', usuarioId, dadosAnteriores: seguro, dadosNovos: row,
      });
      return row;
    });
  }
}
