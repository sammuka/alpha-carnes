import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { rotas } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarQuery, type Paginado } from '../../../common/crud/paginacao';
import type { CreateRotaDto, UpdateRotaDto } from './dto/rota.dto';

type Rota = typeof rotas.$inferSelect;

@Injectable()
export class RotasService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  private normalizarParadas(paradas: { ordem: number; descricao: string }[]) {
    return [...paradas]
      .sort((a, b) => a.ordem - b.ordem)
      .map((p, i) => ({ ordem: i + 1, descricao: p.descricao }));
  }

  private normalizarDias(dias: string[]): string[] {
    const ordem = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    return [...new Set(dias)].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
  }

  async listar(query: ListarQuery): Promise<Paginado<Rota>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(rotas.deletedAt)];
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(or(ilike(rotas.nome, termo), ilike(rotas.codigo, termo), ilike(rotas.regiao, termo)));
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(rotas).where(where).orderBy(desc(rotas.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(rotas).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<Rota> {
    const rota = await this.buscarAtivo(id);
    if (!rota) throw new NotFoundException('Rota não encontrada');
    return rota;
  }

  async criar(dto: CreateRotaDto, usuarioId: string): Promise<Rota> {
    return this.db.transaction(async (tx) => {
      await this.assertCodigoUnico(tx, dto.codigo, null);

      const criado = primeiroOuFalha(
        await tx
          .insert(rotas)
          .values({
            codigo: dto.codigo,
            nome: dto.nome,
            regiao: dto.regiao,
            representantePadrao: dto.representantePadrao,
            caminhaoPadrao: dto.caminhaoPadrao,
            motoristaPadrao: dto.motoristaPadrao,
            observacoes: dto.observacoes,
            paradas: this.normalizarParadas(dto.paradas),
            diasAtendimento: this.normalizarDias(dto.diasAtendimento),
            status: dto.status,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'rotas',
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

  async atualizar(id: string, dto: UpdateRotaDto, usuarioId: string): Promise<Rota> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Rota não encontrada');

      await this.assertCodigoUnico(tx, dto.codigo ?? anterior.codigo, id);

      const atualizado = primeiroOuFalha(
        await tx
          .update(rotas)
          .set({
            codigo: dto.codigo ?? anterior.codigo,
            nome: dto.nome ?? anterior.nome,
            regiao: dto.regiao ?? anterior.regiao,
            representantePadrao: dto.representantePadrao ?? anterior.representantePadrao,
            caminhaoPadrao: dto.caminhaoPadrao ?? anterior.caminhaoPadrao,
            motoristaPadrao: dto.motoristaPadrao ?? anterior.motoristaPadrao,
            observacoes: dto.observacoes ?? anterior.observacoes,
            paradas: dto.paradas ? this.normalizarParadas(dto.paradas) : anterior.paradas,
            diasAtendimento: dto.diasAtendimento
              ? this.normalizarDias(dto.diasAtendimento)
              : anterior.diasAtendimento,
            status: dto.status ?? anterior.status,
          })
          .where(eq(rotas.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'rotas',
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
      if (!anterior) throw new NotFoundException('Rota não encontrada');

      const removido = primeiroOuFalha(
        await tx.update(rotas).set({ deletedAt: new Date() }).where(eq(rotas.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'rotas',
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

  async restaurar(id: string, usuarioId: string): Promise<Rota> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(rotas)
        .where(eq(rotas.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Rota não encontrada');
      if (!anterior.deletedAt) throw new ConflictException('Rota não está removida');

      await this.assertCodigoUnico(tx, anterior.codigo, id);

      const restaurado = primeiroOuFalha(
        await tx.update(rotas).set({ deletedAt: null }).where(eq(rotas.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'rotas',
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

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Rota | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(rotas)
      .where(and(eq(rotas.id, id), isNull(rotas.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async assertCodigoUnico(
    tx: NodePgDatabase<typeof schema>,
    codigo: string,
    idAtual: string | null,
  ): Promise<void> {
    const conflitos = await tx
      .select({ id: rotas.id })
      .from(rotas)
      .where(and(isNull(rotas.deletedAt), eq(rotas.codigo, codigo)));
    for (const c of conflitos) {
      if (idAtual && c.id === idAtual) continue;
      throw new ConflictException('Já existe rota com este código');
    }
  }
}
