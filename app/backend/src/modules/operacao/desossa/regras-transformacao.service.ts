import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { produtos, regrasTransformacao, regrasTransformacaoSaidas } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarQuery, type Paginado } from '../../../common/crud/paginacao';
import type { CreateRegraTransformacaoDto, UpdateRegraTransformacaoDto } from './dto/regra-transformacao.dto';

type Regra = typeof regrasTransformacao.$inferSelect;
type Saida = typeof regrasTransformacaoSaidas.$inferSelect;

export type RegraTransformacaoDetalhe = Regra & { saidas: Saida[] };

@Injectable()
export class RegrasTransformacaoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<RegraTransformacaoDetalhe>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(regrasTransformacao.deletedAt);

    const [linhas, totalRow] = await Promise.all([
      this.db
        .select()
        .from(regrasTransformacao)
        .where(where)
        .orderBy(desc(regrasTransformacao.prioridade), desc(regrasTransformacao.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(regrasTransformacao).where(where),
    ]);

    const detalhes = await Promise.all(linhas.map((r) => this.montarDetalhe(r)));
    return montarPaginado(detalhes, totalRow[0]?.total ?? 0, query);
  }

  async detalhar(id: string): Promise<RegraTransformacaoDetalhe> {
    const regra = await this.buscarAtivo(id);
    if (!regra) throw new NotFoundException('Regra de transformação não encontrada');
    return this.montarDetalhe(regra);
  }

  async criar(dto: CreateRegraTransformacaoDto, usuarioId: string): Promise<RegraTransformacaoDetalhe> {
    return this.db.transaction(async (tx) => {
      await this.assertProdutosValidos(tx, dto.saidas.map((s) => s.produtoId));

      const criada = primeiroOuFalha(
        await tx
          .insert(regrasTransformacao)
          .values({
            nome: dto.nome,
            produtoOrigemCodigo: dto.produtoOrigemCodigo,
            status: dto.status,
            prioridade: dto.prioridade,
            observacao: dto.observacao,
          })
          .returning(),
      );

      const saidas = await this.inserirSaidas(tx, criada.id, dto.saidas);

      await this.auditoria.registrar(tx, {
        tabela: 'regras_transformacao',
        registroId: criada.id,
        operacao: 'INSERT',
        modulo: 'desossa',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: { ...criada, saidas },
      });

      return { ...criada, saidas };
    });
  }

  async atualizar(
    id: string,
    dto: UpdateRegraTransformacaoDto,
    usuarioId: string,
  ): Promise<RegraTransformacaoDetalhe> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Regra de transformação não encontrada');

      if (dto.saidas) {
        await this.assertProdutosValidos(tx, dto.saidas.map((s) => s.produtoId));
      }

      const atualizada = primeiroOuFalha(
        await tx
          .update(regrasTransformacao)
          .set({
            nome: dto.nome ?? anterior.nome,
            produtoOrigemCodigo: dto.produtoOrigemCodigo ?? anterior.produtoOrigemCodigo,
            status: dto.status ?? anterior.status,
            prioridade: dto.prioridade ?? anterior.prioridade,
            observacao: dto.observacao === undefined ? anterior.observacao : dto.observacao,
          })
          .where(eq(regrasTransformacao.id, id))
          .returning(),
      );

      let saidas: Saida[];
      if (dto.saidas) {
        await tx.delete(regrasTransformacaoSaidas).where(eq(regrasTransformacaoSaidas.regraId, id));
        saidas = await this.inserirSaidas(tx, id, dto.saidas);
      } else {
        saidas = await tx
          .select()
          .from(regrasTransformacaoSaidas)
          .where(eq(regrasTransformacaoSaidas.regraId, id));
      }

      await this.auditoria.registrar(tx, {
        tabela: 'regras_transformacao',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'desossa',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: { ...atualizada, saidas },
      });

      return { ...atualizada, saidas };
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Regra de transformação não encontrada');

      const removida = primeiroOuFalha(
        await tx
          .update(regrasTransformacao)
          .set({ deletedAt: new Date() })
          .where(eq(regrasTransformacao.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_transformacao',
        registroId: id,
        operacao: 'DELETE',
        modulo: 'desossa',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: removida,
      });
      return { id, deletedAt: removida.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<RegraTransformacaoDetalhe> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(regrasTransformacao)
        .where(eq(regrasTransformacao.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Regra de transformação não encontrada');
      if (!anterior.deletedAt) throw new ConflictException('Regra de transformação não está removida');

      const restaurada = primeiroOuFalha(
        await tx.update(regrasTransformacao).set({ deletedAt: null }).where(eq(regrasTransformacao.id, id)).returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_transformacao',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'desossa',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: restaurada,
      });

      return this.montarDetalhe(restaurada, tx);
    });
  }

  private async montarDetalhe(regra: Regra, tx?: NodePgDatabase<typeof schema>): Promise<RegraTransformacaoDetalhe> {
    const exec = tx ?? this.db;
    const saidas = await exec
      .select()
      .from(regrasTransformacaoSaidas)
      .where(eq(regrasTransformacaoSaidas.regraId, regra.id));
    return { ...regra, saidas };
  }

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Regra | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(regrasTransformacao)
      .where(and(eq(regrasTransformacao.id, id), isNull(regrasTransformacao.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async inserirSaidas(
    tx: NodePgDatabase<typeof schema>,
    regraId: string,
    saidas: CreateRegraTransformacaoDto['saidas'],
  ): Promise<Saida[]> {
    return tx
      .insert(regrasTransformacaoSaidas)
      .values(
        saidas.map((s) => ({
          regraId,
          produtoId: s.produtoId,
          quantidadeFixa: s.quantidadeFixa.toString(),
        })),
      )
      .returning();
  }

  private async assertProdutosValidos(tx: NodePgDatabase<typeof schema>, produtoIds: string[]): Promise<void> {
    const unicos = [...new Set(produtoIds)];
    const encontrados = await tx
      .select({ id: produtos.id })
      .from(produtos)
      .where(and(inArray(produtos.id, unicos), isNull(produtos.deletedAt), eq(produtos.status, 'ativo')));

    if (encontrados.length !== unicos.length) {
      throw new BadRequestException('Um ou mais produtos de saída são inválidos ou inativos');
    }
  }
}
