import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { produtos } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import {
  calcularRange,
  montarPaginado,
  primeiroOuFalha,
  type ListarProdutoQuery,
  type Paginado,
} from '../../../common/crud/paginacao';
import type { CreateProdutoDto, UpdateProdutoDto } from './dto/produto.dto';

type Produto = typeof produtos.$inferSelect;
type ProdutoPayload = {
  codigo: string;
  nome: string;
  nomeOperacional?: string | null;
  categoria?: string | null;
  tipoOperacional: string;
  unidadePedido: string;
  unidadePreco: string;
  exigePeso: boolean;
  passaBalanca: boolean;
  passaDesossa: boolean;
  origemTransformacao: boolean;
  saidaTransformacao: boolean;
  podeEstoque: boolean;
  ativoVenda: boolean;
  ativoCompra: boolean;
  status: string;
  observacoesOperacionais?: string | null;
  atributosJson?: Record<string, unknown>;
};

@Injectable()
export class ProdutosService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarProdutoQuery): Promise<Paginado<Produto>> {
    const { limit, offset } = calcularRange(query);
    const filtros = [query.incluirRemovidos ? undefined : isNull(produtos.deletedAt)];
    if (query.status) filtros.push(eq(produtos.status, query.status));
    if (query.ativoVenda !== undefined) filtros.push(eq(produtos.ativoVenda, query.ativoVenda));
    if (query.ativoCompra !== undefined) filtros.push(eq(produtos.ativoCompra, query.ativoCompra));
    if (query.search) {
      const termo = `%${query.search}%`;
      filtros.push(
        or(
          ilike(produtos.nome, termo),
          ilike(produtos.codigo, termo),
          ilike(produtos.nomeOperacional, termo),
        ),
      );
    }
    const where = and(...filtros.filter(Boolean));

    const [linhas, totalRow] = await Promise.all([
      this.db.select().from(produtos).where(where).orderBy(desc(produtos.createdAt)).limit(limit).offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(produtos).where(where),
    ]);

    return montarPaginado(linhas, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<Produto> {
    const produto = await this.buscarAtivo(id);
    if (!produto) throw new NotFoundException('Produto não encontrado');
    return produto;
  }

  async criar(dto: CreateProdutoDto, usuarioId: string): Promise<Produto> {
    return this.db.transaction(async (tx) => {
      await this.assertCodigoUnico(tx, dto.codigo, null);

      const criado = primeiroOuFalha(
        await tx
          .insert(produtos)
          .values({
            codigo: dto.codigo,
            nome: dto.nome,
            nomeOperacional: dto.nomeOperacional,
            categoria: dto.categoria,
            tipoOperacional: dto.tipoOperacional,
            unidadePedido: dto.unidadePedido,
            unidadePreco: dto.unidadePreco,
            exigePeso: dto.exigePeso,
            passaBalanca: dto.passaBalanca,
            passaDesossa: dto.passaDesossa,
            origemTransformacao: dto.origemTransformacao,
            saidaTransformacao: dto.saidaTransformacao,
            podeEstoque: dto.podeEstoque,
            ativoVenda: dto.ativoVenda,
            ativoCompra: dto.ativoCompra,
            status: dto.status,
            observacoesOperacionais: dto.observacoesOperacionais,
            atributosJson: dto.atributosJson ?? {},
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'produtos',
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

  async atualizar(id: string, dto: UpdateProdutoDto, usuarioId: string): Promise<Produto> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Produto não encontrado');

      await this.assertCodigoUnico(tx, dto.codigo ?? anterior.codigo, id);

      const payload = this.montarPayload(anterior, dto);

      const atualizado = primeiroOuFalha(
        await tx
          .update(produtos)
          .set({
            codigo: payload.codigo,
            nome: payload.nome,
            nomeOperacional: payload.nomeOperacional,
            categoria: payload.categoria,
            tipoOperacional: payload.tipoOperacional,
            unidadePedido: payload.unidadePedido,
            unidadePreco: payload.unidadePreco,
            exigePeso: payload.exigePeso,
            passaBalanca: payload.passaBalanca,
            passaDesossa: payload.passaDesossa,
            origemTransformacao: payload.origemTransformacao,
            saidaTransformacao: payload.saidaTransformacao,
            podeEstoque: payload.podeEstoque,
            ativoVenda: payload.ativoVenda,
            ativoCompra: payload.ativoCompra,
            status: payload.status,
            observacoesOperacionais: payload.observacoesOperacionais,
            atributosJson: payload.atributosJson,
          })
          .where(eq(produtos.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'produtos',
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
      if (!anterior) throw new NotFoundException('Produto não encontrado');

      const removido = primeiroOuFalha(
        await tx.update(produtos).set({ deletedAt: new Date() }).where(eq(produtos.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'produtos',
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

  async restaurar(id: string, usuarioId: string): Promise<Produto> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(produtos)
        .where(eq(produtos.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Produto não encontrado');
      if (!anterior.deletedAt) throw new ConflictException('Produto não está removido');

      await this.assertCodigoUnico(tx, anterior.codigo, id);

      const restaurado = primeiroOuFalha(
        await tx.update(produtos).set({ deletedAt: null }).where(eq(produtos.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'produtos',
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

  private montarPayload(anterior: Produto, dto: UpdateProdutoDto): ProdutoPayload {
    return {
      codigo: dto.codigo ?? anterior.codigo,
      nome: dto.nome ?? anterior.nome,
      nomeOperacional: dto.nomeOperacional ?? anterior.nomeOperacional ?? undefined,
      categoria: dto.categoria ?? anterior.categoria ?? undefined,
      tipoOperacional: dto.tipoOperacional ?? anterior.tipoOperacional,
      unidadePedido: dto.unidadePedido ?? anterior.unidadePedido,
      unidadePreco: dto.unidadePreco ?? anterior.unidadePreco,
      exigePeso: dto.exigePeso ?? anterior.exigePeso,
      passaBalanca: dto.passaBalanca ?? anterior.passaBalanca,
      passaDesossa: dto.passaDesossa ?? anterior.passaDesossa,
      origemTransformacao: dto.origemTransformacao ?? anterior.origemTransformacao,
      saidaTransformacao: dto.saidaTransformacao ?? anterior.saidaTransformacao,
      podeEstoque: dto.podeEstoque ?? anterior.podeEstoque,
      ativoVenda: dto.ativoVenda ?? anterior.ativoVenda,
      ativoCompra: dto.ativoCompra ?? anterior.ativoCompra,
      status: dto.status ?? anterior.status,
      observacoesOperacionais: dto.observacoesOperacionais ?? anterior.observacoesOperacionais ?? undefined,
      atributosJson: dto.atributosJson ?? (anterior.atributosJson as Record<string, unknown>),
    };
  }

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Produto | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(produtos)
      .where(and(eq(produtos.id, id), isNull(produtos.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async assertCodigoUnico(
    tx: NodePgDatabase<typeof schema>,
    codigo: string,
    idAtual: string | null,
  ): Promise<void> {
    const conflitos = await tx
      .select({ id: produtos.id })
      .from(produtos)
      .where(and(isNull(produtos.deletedAt), eq(produtos.codigo, codigo)));
    for (const c of conflitos) {
      if (idAtual && c.id === idAtual) continue;
      throw new ConflictException('Já existe produto com este código');
    }
  }
}
