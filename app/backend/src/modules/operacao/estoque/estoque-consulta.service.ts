import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { itensComerciais, pecas, produtos, subitens } from '../../../database/schema';

export interface ItemEstoqueConsulta {
  id: string;
  tipo: 'peca' | 'subitem';
  status: string;
  peso: string | null;
  quantidade: string;
  etiqueta: string | null;
  produto: {
    id: string | null;
    codigo: string;
    nome: string;
  };
  itemComercialId: string;
  createdAt: Date;
}

@Injectable()
export class EstoqueConsultaService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async consultar(): Promise<ItemEstoqueConsulta[]> {
    const [pecasEstoque, subitensEstoque] = await Promise.all([
      this.db
        .select({
          id: pecas.id,
          status: pecas.statusPeca,
          peso: pecas.pesoOriginal,
          quantidade: sql<string>`'1'`,
          etiqueta: pecas.etiquetaAtual,
          itemComercialId: pecas.itemComercialBaseId,
          createdAt: pecas.createdAt,
        })
        .from(pecas)
        .where(and(isNull(pecas.deletedAt), eq(pecas.statusPeca, 'em_sobra')))
        .orderBy(desc(pecas.createdAt)),
      this.db
        .select({
          id: subitens.id,
          status: subitens.statusSubitem,
          peso: subitens.peso,
          quantidade: subitens.quantidade,
          etiqueta: subitens.etiquetaAtual,
          itemComercialId: subitens.itemComercialId,
          createdAt: subitens.createdAt,
        })
        .from(subitens)
        .where(and(isNull(subitens.deletedAt), eq(subitens.statusSubitem, 'em_sobra')))
        .orderBy(desc(subitens.createdAt)),
    ]);

    const itemComercialIds = [
      ...new Set([
        ...pecasEstoque.map((p) => p.itemComercialId),
        ...subitensEstoque.map((s) => s.itemComercialId),
      ]),
    ];

    const [itensMap, produtosMap] = await Promise.all([
      this.carregarItensComerciais(itemComercialIds),
      this.carregarProdutosPorItemComercial(itemComercialIds),
    ]);

    const itens: ItemEstoqueConsulta[] = [];

    for (const peca of pecasEstoque) {
      const item = itensMap.get(peca.itemComercialId);
      const produto = produtosMap.get(peca.itemComercialId);
      itens.push({
        id: peca.id,
        tipo: 'peca',
        status: peca.status,
        peso: peca.peso,
        quantidade: peca.quantidade,
        etiqueta: peca.etiqueta,
        itemComercialId: peca.itemComercialId,
        produto: produto ?? {
          id: null,
          codigo: item?.codigo ?? '—',
          nome: item?.descricao ?? 'Item comercial',
        },
        createdAt: peca.createdAt,
      });
    }

    for (const sub of subitensEstoque) {
      const item = itensMap.get(sub.itemComercialId);
      const produto = produtosMap.get(sub.itemComercialId);
      itens.push({
        id: sub.id,
        tipo: 'subitem',
        status: sub.status,
        peso: sub.peso,
        quantidade: sub.quantidade,
        etiqueta: sub.etiqueta,
        itemComercialId: sub.itemComercialId,
        produto: produto ?? {
          id: null,
          codigo: item?.codigo ?? '—',
          nome: item?.descricao ?? 'Item comercial',
        },
        createdAt: sub.createdAt,
      });
    }

    return itens.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private async carregarItensComerciais(ids: string[]) {
    const map = new Map<string, { codigo: string; descricao: string }>();
    if (ids.length === 0) return map;

    const linhas = await this.db
      .select({ id: itensComerciais.id, codigo: itensComerciais.codigo, descricao: itensComerciais.descricao })
      .from(itensComerciais)
      .where(and(inArray(itensComerciais.id, ids), isNull(itensComerciais.deletedAt)));

    for (const linha of linhas) {
      map.set(linha.id, { codigo: linha.codigo, descricao: linha.descricao });
    }
    return map;
  }

  private async carregarProdutosPorItemComercial(itemComercialIds: string[]) {
    const map = new Map<string, { id: string; codigo: string; nome: string }>();
    if (itemComercialIds.length === 0) return map;

    const linhas = await this.db
      .select({
        itemComercialId: produtos.legadoItemComercialId,
        id: produtos.id,
        codigo: produtos.codigo,
        nome: produtos.nome,
      })
      .from(produtos)
      .where(
        and(
          isNull(produtos.deletedAt),
          eq(produtos.status, 'ativo'),
          inArray(produtos.legadoItemComercialId, itemComercialIds),
        ),
      );

    for (const linha of linhas) {
      if (linha.itemComercialId) {
        map.set(linha.itemComercialId, { id: linha.id, codigo: linha.codigo, nome: linha.nome });
      }
    }
    return map;
  }
}
