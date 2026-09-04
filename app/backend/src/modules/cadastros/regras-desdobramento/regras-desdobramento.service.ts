import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { produtos, regrasDesdobramentoComercial } from '../../../database/schema';
import { AuditoriaService } from '../../../common/auditoria/auditoria.service';
import { multiplicar } from '../../../common/crud/decimal';
import { calcularRange, montarPaginado, primeiroOuFalha, type ListarQuery, type Paginado } from '../../../common/crud/paginacao';
import type { CreateRegraDesdobramentoDto, UpdateRegraDesdobramentoDto } from './dto/regra-desdobramento.dto';

type Regra = typeof regrasDesdobramentoComercial.$inferSelect;

/** Estado efetivo de uma regra após aplicar um update parcial, usado nas validações. */
interface EstadoRegra {
  produtoOrigemId: string;
  produtoDestinoId: string;
  status: string;
  vigenciaInicio: Date;
  vigenciaFim: Date | null;
}

@Injectable()
export class RegrasDesdobramentoService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
    private readonly auditoria: AuditoriaService,
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async listar(query: ListarQuery): Promise<Paginado<Regra>> {
    const { limit, offset } = calcularRange(query);
    const where = query.incluirRemovidos ? undefined : isNull(regrasDesdobramentoComercial.deletedAt);
    const produtoOrigem = alias(produtos, 'produto_origem');
    const produtoDestino = alias(produtos, 'produto_destino');

    const [linhas, totalRow] = await Promise.all([
      this.db.select({
        id: regrasDesdobramentoComercial.id,
        produtoOrigemId: regrasDesdobramentoComercial.produtoOrigemId,
        produtoDestinoId: regrasDesdobramentoComercial.produtoDestinoId,
        fatorQuantidade: regrasDesdobramentoComercial.fatorQuantidade,
        status: regrasDesdobramentoComercial.status,
        vigenciaInicio: regrasDesdobramentoComercial.vigenciaInicio,
        vigenciaFim: regrasDesdobramentoComercial.vigenciaFim,
        observacoes: regrasDesdobramentoComercial.observacoes,
        createdAt: regrasDesdobramentoComercial.createdAt,
        updatedAt: regrasDesdobramentoComercial.updatedAt,
        deletedAt: regrasDesdobramentoComercial.deletedAt,
        produtoOrigemCodigo: produtoOrigem.codigo,
        produtoOrigemNome: produtoOrigem.nome,
        produtoDestinoCodigo: produtoDestino.codigo,
        produtoDestinoNome: produtoDestino.nome,
      }).from(regrasDesdobramentoComercial)
        .innerJoin(produtoOrigem, eq(produtoOrigem.id, regrasDesdobramentoComercial.produtoOrigemId))
        .innerJoin(produtoDestino, eq(produtoDestino.id, regrasDesdobramentoComercial.produtoDestinoId))
        .where(where)
        .orderBy(desc(regrasDesdobramentoComercial.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(regrasDesdobramentoComercial).where(where),
    ]);
    const total = totalRow[0]?.total ?? 0;
    if (linhas.length !== Math.min(limit, Math.max(0, total - offset))) {
      throw new ConflictException({ codigo: 'REGRA_REFERENCIA_INVALIDA', message: 'Regra possui produto de origem ou destino ausente' });
    }
    return montarPaginado(linhas, total, query);
  }

  async detalhar(id: string): Promise<Regra> {
    const regra = await this.buscarAtivo(id);
    if (!regra) throw new NotFoundException('Regra de desdobramento não encontrada');
    return regra;
  }

  async criar(dto: CreateRegraDesdobramentoDto, usuarioId: string): Promise<Regra> {
    return this.db.transaction(async (tx) => {
      const estado: EstadoRegra = {
        produtoOrigemId: dto.produtoOrigemId,
        produtoDestinoId: dto.produtoDestinoId,
        status: dto.status,
        vigenciaInicio: dto.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim ?? null,
      };

      await this.assertProdutosAtivos(tx, estado.produtoOrigemId, estado.produtoDestinoId);
      if (estado.status === 'ativo') {
        await this.assertSemSobreposicaoAtiva(tx, estado, null);
      }

      const criada = primeiroOuFalha(
        await tx
          .insert(regrasDesdobramentoComercial)
          .values({
            produtoOrigemId: estado.produtoOrigemId,
            produtoDestinoId: estado.produtoDestinoId,
            fatorQuantidade: dto.fatorQuantidade.toString(),
            status: estado.status,
            vigenciaInicio: estado.vigenciaInicio,
            vigenciaFim: estado.vigenciaFim,
            observacoes: dto.observacoes,
          })
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_desdobramento_comercial',
        registroId: criada.id,
        operacao: 'INSERT',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: {},
        dadosNovos: criada,
      });
      return criada;
    });
  }

  async atualizar(id: string, dto: UpdateRegraDesdobramentoDto, usuarioId: string): Promise<Regra> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Regra de desdobramento não encontrada');

      const estado: EstadoRegra = {
        produtoOrigemId: dto.produtoOrigemId ?? anterior.produtoOrigemId,
        produtoDestinoId: dto.produtoDestinoId ?? anterior.produtoDestinoId,
        status: dto.status ?? anterior.status,
        vigenciaInicio: dto.vigenciaInicio ?? anterior.vigenciaInicio,
        vigenciaFim: dto.vigenciaFim === undefined ? anterior.vigenciaFim : dto.vigenciaFim,
      };

      await this.assertProdutosAtivos(tx, estado.produtoOrigemId, estado.produtoDestinoId);
      if (estado.status === 'ativo') {
        await this.assertSemSobreposicaoAtiva(tx, estado, id);
      }

      const atualizada = primeiroOuFalha(
        await tx
          .update(regrasDesdobramentoComercial)
          .set({
            produtoOrigemId: estado.produtoOrigemId,
            produtoDestinoId: estado.produtoDestinoId,
            fatorQuantidade:
              dto.fatorQuantidade !== undefined ? dto.fatorQuantidade.toString() : anterior.fatorQuantidade,
            status: estado.status,
            vigenciaInicio: estado.vigenciaInicio,
            vigenciaFim: estado.vigenciaFim,
            observacoes: dto.observacoes ?? anterior.observacoes,
          })
          .where(eq(regrasDesdobramentoComercial.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_desdobramento_comercial',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: atualizada,
      });
      return atualizada;
    });
  }

  async remover(id: string, usuarioId: string): Promise<{ id: string; deletedAt: Date }> {
    return this.db.transaction(async (tx) => {
      const anterior = await this.buscarAtivo(id, tx);
      if (!anterior) throw new NotFoundException('Regra de desdobramento não encontrada');

      const removida = primeiroOuFalha(
        await tx
          .update(regrasDesdobramentoComercial)
          .set({ deletedAt: new Date() })
          .where(eq(regrasDesdobramentoComercial.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_desdobramento_comercial',
        registroId: id,
        operacao: 'DELETE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: removida,
      });
      return { id, deletedAt: removida.deletedAt as Date };
    });
  }

  async restaurar(id: string, usuarioId: string): Promise<Regra> {
    return this.db.transaction(async (tx) => {
      const anterior = await tx
        .select()
        .from(regrasDesdobramentoComercial)
        .where(eq(regrasDesdobramentoComercial.id, id))
        .then((r) => r[0] ?? null);
      if (!anterior) throw new NotFoundException('Regra de desdobramento não encontrada');
      if (!anterior.deletedAt) throw new ConflictException('Regra de desdobramento não está removida');

      const estado: EstadoRegra = {
        produtoOrigemId: anterior.produtoOrigemId,
        produtoDestinoId: anterior.produtoDestinoId,
        status: anterior.status,
        vigenciaInicio: anterior.vigenciaInicio,
        vigenciaFim: anterior.vigenciaFim,
      };
      if (estado.status === 'ativo') {
        await this.assertSemSobreposicaoAtiva(tx, estado, id);
      }

      const restaurada = primeiroOuFalha(
        await tx
          .update(regrasDesdobramentoComercial)
          .set({ deletedAt: null })
          .where(eq(regrasDesdobramentoComercial.id, id))
          .returning(),
      );

      await this.auditoria.registrar(tx, {
        tabela: 'regras_desdobramento_comercial',
        registroId: id,
        operacao: 'UPDATE',
        modulo: 'cadastros',
        usuarioId,
        dadosAnteriores: anterior,
        dadosNovos: restaurada,
      });
      return restaurada;
    });
  }

  /**
   * Simulador da aba "Desdobramento de Compra" (RegraDesdobramento.tsx, linhas 203–240).
   * Multiplica a quantidade comprada pelo fator de cada produto destino ativo da origem.
   */
  async simular(produtoOrigemId: string, quantidade: number): Promise<{
    quantidade: number;
    itens: Array<{ produtoId: string; descricao: string; fator: string; total: number }>;
    somaFatores: number;
    totalPartes: number;
  }> {
    const regras = await this.db
      .select({
        produtoId: regrasDesdobramentoComercial.produtoDestinoId,
        descricao: produtos.nome,
        fator: regrasDesdobramentoComercial.fatorQuantidade,
      })
      .from(regrasDesdobramentoComercial)
      .innerJoin(produtos, eq(regrasDesdobramentoComercial.produtoDestinoId, produtos.id))
      .where(and(
        eq(regrasDesdobramentoComercial.produtoOrigemId, produtoOrigemId),
        eq(regrasDesdobramentoComercial.status, 'ativo'),
        isNull(regrasDesdobramentoComercial.deletedAt),
      ))
      .orderBy(produtos.nome);

    const itens = regras.map((r) => ({
      produtoId: r.produtoId,
      descricao: r.descricao,
      fator: r.fator,
      total: multiplicar(r.fator, quantidade),
    }));

    return {
      quantidade,
      itens,
      somaFatores: itens.reduce((s, i) => s + Number(i.fator), 0),
      totalPartes: itens.reduce((s, i) => s + i.total, 0),
    };
  }

  private async buscarAtivo(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Regra | null> {
    const exec = tx ?? this.db;
    return exec
      .select()
      .from(regrasDesdobramentoComercial)
      .where(and(eq(regrasDesdobramentoComercial.id, id), isNull(regrasDesdobramentoComercial.deletedAt)))
      .then((r) => r[0] ?? null);
  }

  private async assertProdutosAtivos(
    tx: NodePgDatabase<typeof schema>,
    produtoOrigemId: string,
    produtoDestinoId: string,
  ): Promise<void> {
    const origem = await tx
      .select({ id: produtos.id })
      .from(produtos)
      .where(and(
        eq(produtos.id, produtoOrigemId),
        isNull(produtos.deletedAt),
        eq(produtos.status, 'ativo'),
        eq(produtos.ativoCompra, true),
      ))
      .then((r) => r[0] ?? null);
    if (!origem) throw new BadRequestException('Produto de origem inexistente, inativo ou não comprável');

    const destino = await tx
      .select({ id: produtos.id })
      .from(produtos)
      .where(and(
        eq(produtos.id, produtoDestinoId),
        isNull(produtos.deletedAt),
        eq(produtos.status, 'ativo'),
        eq(produtos.ativoVenda, true),
      ))
      .then((r) => r[0] ?? null);
    if (!destino) throw new BadRequestException('Produto de destino inexistente, inativo ou não vendável');
  }

  private async assertSemSobreposicaoAtiva(
    tx: NodePgDatabase<typeof schema>,
    estado: EstadoRegra,
    idAtual: string | null,
  ): Promise<void> {
    const inicio = estado.vigenciaInicio;
    const fim = estado.vigenciaFim;

    const condicoes = [
      isNull(regrasDesdobramentoComercial.deletedAt),
      eq(regrasDesdobramentoComercial.status, 'ativo'),
      eq(regrasDesdobramentoComercial.produtoOrigemId, estado.produtoOrigemId),
      eq(regrasDesdobramentoComercial.produtoDestinoId, estado.produtoDestinoId),
      fim ? sql`${regrasDesdobramentoComercial.vigenciaInicio} < ${fim}` : undefined,
      or(
        isNull(regrasDesdobramentoComercial.vigenciaFim),
        sql`${regrasDesdobramentoComercial.vigenciaFim} > ${inicio}`,
      ),
    ];
    if (idAtual) condicoes.push(ne(regrasDesdobramentoComercial.id, idAtual));

    const sobreposta = await tx
      .select({ id: regrasDesdobramentoComercial.id })
      .from(regrasDesdobramentoComercial)
      .where(and(...condicoes.filter(Boolean)))
      .then((r) => r[0] ?? null);

    if (sobreposta) {
      throw new ConflictException(
        'Já existe regra de desdobramento ativa para este par de produtos com vigência sobreposta',
      );
    }
  }
}
