import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { parametros } from '../../database/schema';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarQuery, type Paginado } from '../../common/crud/paginacao';
import type { CreateParametroDto, UpdateParametroDto } from './dto/parametro.dto';

type Parametro = typeof parametros.$inferSelect;

@Injectable()
export class ParametrosService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<Parametro>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(parametros.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(or(ilike(parametros.chave, termo), ilike(parametros.descricao, termo)));
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(parametros).where(where).orderBy(desc(parametros.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(parametros).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<Parametro> {
    const param = await this.buscarAtivo(id);
    if (!param) throw new NotFoundException('Parâmetro não encontrado');
    return param;
  }

  async detalharPorChave(chave: string): Promise<Parametro> {
    const param = await this.db
      .select()
      .from(parametros)
      .where(and(eq(parametros.chave, chave), isNull(parametros.deletedAt)))
      .then((r) => r[0] ?? null);
    if (!param) throw new NotFoundException('Parâmetro não encontrado');
    return param;
  }

  async atualizarPorChave(
    chave: string,
    valorJson: Record<string, unknown>,
    usuarioId: string,
  ): Promise<Parametro> {
    const atual = await this.detalharPorChave(chave);
    return this.atualizar(atual.id, { valorJson }, usuarioId);
  }

  async criar(dto: CreateParametroDto, usuarioId: string): Promise<Parametro> {
    return this.db.transaction(async (tx) => {
      const existente = await tx
        .select({ id: parametros.id })
        .from(parametros)
        .where(and(isNull(parametros.deletedAt), eq(parametros.chave, dto.chave)))
        .then((r) => r[0] ?? null);
      if (existente) throw new ConflictException('Já existe parâmetro com esta chave');

      const criado = primeiroOuFalha(
        await tx
          .insert(parametros)
          .values({ chave: dto.chave, valorJson: dto.valorJson ?? {}, descricao: dto.descricao })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'parametros',
        registroId: criado.id,
        operacao: 'INSERT',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: criado,
      });
      return criado;
    });
  }

  async atualizar(id: string, dto: UpdateParametroDto, usuarioId: string): Promise<Parametro> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Parâmetro não encontrado');

      const atualizado = primeiroOuFalha(
        await tx
          .update(parametros)
          .set({
            valorJson: dto.valorJson ?? anterior.valorJson,
            descricao: dto.descricao ?? anterior.descricao,
          })
          .where(eq(parametros.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'parametros',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizado,
      });
      return atualizado;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Parâmetro não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(parametros).set({ deletedAt: new Date() }).where(eq(parametros.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'parametros',
        registroId: id,
        operacao: 'DELETE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: removido,
      });
      return { id, deletedAt: removido.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<Parametro> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(parametros)
        .where(eq(parametros.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Parâmetro não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Parâmetro não está removido');

      const conflito = await tx
        .select({ id: parametros.id })
        .from(parametros)
        .where(and(isNull(parametros.deletedAt), eq(parametros.chave, anterior.chave)))
        .then((r) => r[0] ?? null);
      if (conflito) throw new ConflictException('Já existe parâmetro ativo com esta chave');

      const restaurado = primeiroOuFalha(
        await tx.update(parametros).set({ deletedAt: null }).where(eq(parametros.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'parametros',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: restaurado,
      });
      return restaurado;
    });
  }

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Parametro | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(parametros)
      .where(and(eq(parametros.id, id), isNull(parametros.deletedAt)))
      .then((r) => r[0] ?? null);
  }
}
