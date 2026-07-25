import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { modelosEtiqueta } from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  calcularRange, montarPaginado, primeiroOuFalha,
  type ListarQuery, type Paginado,
} from '../../common/crud/paginacao';
import type { CreateModeloEtiquetaDto, UpdateModeloEtiquetaDto } from './dto/modelo-etiqueta.dto';

type ModeloEtiqueta = typeof modelosEtiqueta.$inferSelect;

@Injectable()
export class ModelosEtiquetaService {
  constructor(
    @Inject(DRIZZLE) private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<ModeloEtiqueta>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(modelosEtiqueta.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(or(ilike(modelosEtiqueta.nome, termo), ilike(modelosEtiqueta.slug, termo)));
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(modelosEtiqueta).where(where)
        .orderBy(asc(modelosEtiqueta.nome)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(modelosEtiqueta).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<ModeloEtiqueta> {
    const registro = await this.buscarAtivo(id);
    if (!registro) throw new NotFoundException('Modelo de etiqueta não encontrado');
    return registro;
  }

  async criar(dto: CreateModeloEtiquetaDto, usuarioId: string): Promise<ModeloEtiqueta> {
    return this.db.transaction(async (tx) => {
      await this.assertSlugLivre(tx, dto.slug);

      const criado = primeiroOuFalha(
        await tx.insert(modelosEtiqueta).values({
          slug: dto.slug,
          nome: dto.nome,
          campos: dto.campos,
          status: dto.status,
        }).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'modelos_etiqueta', registroId: criado.id, operacao: 'INSERT',
        modulo: 'cadastros', usuarioId, dadosAnteriores: {}, dadosNovos: criado,
      });
      return criado;
    });
  }

  async atualizar(id: string, dto: UpdateModeloEtiquetaDto, usuarioId: string): Promise<ModeloEtiqueta> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Modelo de etiqueta não encontrado');

      const atualizado = primeiroOuFalha(
        await tx.update(modelosEtiqueta).set({
          nome: dto.nome ?? anterior.nome,
          campos: dto.campos ?? anterior.campos,
          status: dto.status ?? anterior.status,
        }).where(eq(modelosEtiqueta.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'modelos_etiqueta', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Modelo de etiqueta não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(modelosEtiqueta).set({ deletedAt: new Date() })
          .where(eq(modelosEtiqueta.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'modelos_etiqueta', registroId: id, operacao: 'DELETE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<ModeloEtiqueta> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx.select().from(modelosEtiqueta)
        .where(eq(modelosEtiqueta.id, id)).then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Modelo de etiqueta não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Modelo de etiqueta não está removido');
      await this.assertSlugLivre(tx, anterior.slug);

      const restaurado = primeiroOuFalha(
        await tx.update(modelosEtiqueta).set({ deletedAt: null })
          .where(eq(modelosEtiqueta.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'modelos_etiqueta', registroId: id, operacao: 'UPDATE',
        modulo: 'cadastros', usuarioId, dadosAnteriores: anterior, dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  private async assertSlugLivre(tx: NodePgDatabase<typeof schema>, slug: string): Promise<void> {
    const existente = await tx.select({ id: modelosEtiqueta.id }).from(modelosEtiqueta)
      .where(and(isNull(modelosEtiqueta.deletedAt), eq(modelosEtiqueta.slug, slug)))
      .then((r) => r[0] ?? null);
    if (existente) throw new ConflictException('Já existe modelo ativo com este slug');
  }

  private async buscarAtivo(
    id: string,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<ModeloEtiqueta | null> {
    const exec = tx ?? this.db;
    return exec.select().from(modelosEtiqueta)
      .where(and(eq(modelosEtiqueta.id, id), isNull(modelosEtiqueta.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
