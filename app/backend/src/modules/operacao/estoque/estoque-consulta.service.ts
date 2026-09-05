import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  clientes,
  entradasItens,
  fornecedores,
  notasFiscaisFornecedor,
  parametros,
  pecas,
  pedidosVenda,
  produtos,
  recebimentos,
  subitens,
} from '../../../database/schema';
import { caracteristicasDeCapturaMeta } from '../pesagem/compatibilidade';
import type { ConsultaEstoqueQuery } from './dto/estoque.dto';

export interface ItemEstoqueConsulta {
  id: string;
  tipo: 'peca' | 'subitem' | 'entrada';
  codigo: string;
  statusFisico: string;
  statusRotulo: 'Disponível' | 'Destinado a pedido' | 'Em desossa' | 'Bloqueado por ocorrência';
  quantidade: string;
  peso: string | null;
  unidade: string;
  produto: { id: string | null; codigo: string; nome: string };
  origem: string;
  nfLote: string | null;
  local: { valor: string | null; provisorio: boolean };
  caracteristicas: string[];
  pedidoReservado: string | null;
  estoqueAnterior: boolean;
  createdAt: Date;
}

const ROTULO_PECA: Record<string, ItemEstoqueConsulta['statusRotulo']> = {
  em_sobra: 'Disponível', associada: 'Destinado a pedido',
  em_transformacao: 'Em desossa', em_analise: 'Bloqueado por ocorrência',
};
const ROTULO_SUBITEM: Record<string, ItemEstoqueConsulta['statusRotulo']> = {
  em_sobra: 'Disponível', associado: 'Destinado a pedido', em_analise: 'Bloqueado por ocorrência',
};

@Injectable()
export class EstoqueConsultaService {
  constructor(
    @Inject(DRIZZLE)
    private readonly drizzle: { db: NodePgDatabase<typeof schema> },
  ) {}

  private get db() {
    return this.drizzle.db;
  }

  async consultar(filtros: ConsultaEstoqueQuery): Promise<ItemEstoqueConsulta[]> {
    const [pecasEstoque, subitensEstoque, entradasEstoque] = await Promise.all([
      this.db
        .select({
          id: pecas.id,
          statusFisico: pecas.statusPeca,
          peso: pecas.pesoOriginal,
          etiquetaAtual: pecas.etiquetaAtual,
          produtoId: pecas.produtoBaseId,
          recebimentoId: pecas.recebimentoId,
          pedidoVendaId: pecas.pedidoVendaId,
          capturaMeta: pecas.capturaMeta,
          createdAt: pecas.createdAt,
        })
        .from(pecas)
        .where(and(isNull(pecas.deletedAt), inArray(pecas.statusPeca, ['em_sobra', 'associada', 'em_transformacao', 'em_analise']))),
      this.db
        .select({
          id: subitens.id,
          statusFisico: subitens.statusSubitem,
          peso: subitens.peso,
          quantidade: subitens.quantidade,
          etiquetaAtual: subitens.etiquetaAtual,
          produtoId: subitens.produtoId,
          pecaOrigemId: subitens.pecaOrigemId,
          pedidoVendaId: subitens.pedidoVendaId,
          createdAt: subitens.createdAt,
        })
        .from(subitens)
        .where(and(isNull(subitens.deletedAt), inArray(subitens.statusSubitem, ['em_sobra', 'associado', 'em_analise']))),
      this.db
        .select({
          id: entradasItens.id,
          quantidade: entradasItens.quantidade,
          quantidadeDestinada: entradasItens.quantidadeDestinada,
          unidade: entradasItens.unidade,
          produtoId: entradasItens.produtoId,
          fornecedorNome: entradasItens.fornecedorNome,
          loteNf: entradasItens.loteNf,
          local: entradasItens.local,
          destino: entradasItens.destino,
          pedidoId: entradasItens.pedidoId,
          createdAt: entradasItens.createdAt,
        })
        .from(entradasItens)
        .where(and(isNull(entradasItens.deletedAt), sql`${entradasItens.quantidade} > 0`)),
    ]);

    const produtoIds = [
      ...new Set([
        ...pecasEstoque.map((p) => p.produtoId),
        ...subitensEstoque.map((s) => s.produtoId),
        ...entradasEstoque.map((e) => e.produtoId),
      ]),
    ];
    const recebimentoIds = [...new Set(pecasEstoque.map((p) => p.recebimentoId))];
    const pedidoVendaIds = [
      ...new Set([
        ...pecasEstoque.map((p) => p.pedidoVendaId).filter((v): v is string => v !== null),
        ...subitensEstoque.map((s) => s.pedidoVendaId).filter((v): v is string => v !== null),
        ...entradasEstoque.map((e) => e.pedidoId).filter((v): v is string => v !== null),
      ]),
    ];

    const [produtosMap, recebimentosMap, pedidosMap, fifoValor] = await Promise.all([
      this.carregarProdutosPorId(produtoIds),
      this.carregarRecebimentos(recebimentoIds),
      this.carregarPedidos(pedidoVendaIds),
      this.lerParametroFifo(),
    ]);

    const produtoFallback = (produtoId: string) =>
      produtosMap.get(produtoId) ?? { id: produtoId, codigo: '—', nome: 'Produto' };

    const itens: ItemEstoqueConsulta[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const peca of pecasEstoque) {
      const produto = produtoFallback(peca.produtoId);
      const recebimento = recebimentosMap.get(peca.recebimentoId);
      const pedido = peca.pedidoVendaId ? pedidosMap.get(peca.pedidoVendaId) : undefined;
      itens.push({
        id: peca.id,
        tipo: 'peca',
        codigo: peca.etiquetaAtual ?? peca.id.slice(0, 8).toUpperCase(),
        statusFisico: peca.statusFisico,
        statusRotulo: ROTULO_PECA[peca.statusFisico] ?? 'Bloqueado por ocorrência',
        quantidade: '1',
        peso: peca.peso,
        unidade: 'peça',
        produto,
        origem: recebimento?.fornecedorNome ?? '—',
        nfLote: recebimento?.nfLote ?? recebimento?.romaneio ?? null,
        local: { valor: null, provisorio: true },
        caracteristicas: caracteristicasDeCapturaMeta(peca.capturaMeta),
        pedidoReservado: pedido ? `#${pedido.id.slice(0, 8)} — ${pedido.clienteNome}` : null,
        estoqueAnterior: peca.createdAt < hoje,
        createdAt: peca.createdAt,
      });
    }

    for (const sub of subitensEstoque) {
      const produto = produtoFallback(sub.produtoId);
      const pedido = sub.pedidoVendaId ? pedidosMap.get(sub.pedidoVendaId) : undefined;
      itens.push({
        id: sub.id,
        tipo: 'subitem',
        codigo: sub.etiquetaAtual ?? sub.id.slice(0, 8).toUpperCase(),
        statusFisico: sub.statusFisico,
        statusRotulo: ROTULO_SUBITEM[sub.statusFisico] ?? 'Bloqueado por ocorrência',
        quantidade: sub.quantidade,
        peso: sub.peso,
        unidade: 'peça',
        produto,
        origem: `Desossa interna (${sub.pecaOrigemId.slice(0, 8).toUpperCase()})`,
        nfLote: null,
        local: { valor: null, provisorio: true },
        caracteristicas: [],
        pedidoReservado: pedido ? `#${pedido.id.slice(0, 8)} — ${pedido.clienteNome}` : null,
        estoqueAnterior: sub.createdAt < hoje,
        createdAt: sub.createdAt,
      });
    }

    for (const entrada of entradasEstoque) {
      const produto = produtosMap.get(entrada.produtoId) ?? { id: entrada.produtoId, codigo: '—', nome: 'Produto' };
      const pedido = entrada.pedidoId ? pedidosMap.get(entrada.pedidoId) : undefined;
      itens.push({
        id: entrada.id,
        tipo: 'entrada',
        codigo: entrada.id.slice(0, 8).toUpperCase(),
        statusFisico: entrada.destino,
        statusRotulo: entrada.pedidoId ? 'Destinado a pedido' : 'Disponível',
        quantidade: String(entrada.quantidade - entrada.quantidadeDestinada),
        peso: null,
        unidade: entrada.unidade === 'caixa' ? 'caixas' : 'unidades',
        produto,
        origem: entrada.fornecedorNome,
        nfLote: entrada.loteNf,
        local: { valor: entrada.local, provisorio: false },
        caracteristicas: [],
        pedidoReservado: pedido ? `#${pedido.id.slice(0, 8)} — ${pedido.clienteNome}` : null,
        estoqueAnterior: entrada.createdAt < hoje,
        createdAt: entrada.createdAt,
      });
    }

    let filtrados = itens;
    if (filtros.produtoId) {
      filtrados = filtrados.filter((i) => i.produto.id === filtros.produtoId);
    }
    if (filtros.status) {
      const rotuloPorFiltro: Record<string, ItemEstoqueConsulta['statusRotulo']> = {
        disponivel: 'Disponível', destinado: 'Destinado a pedido',
        em_desossa: 'Em desossa', bloqueado: 'Bloqueado por ocorrência',
      };
      filtrados = filtrados.filter((i) => i.statusRotulo === rotuloPorFiltro[filtros.status!]);
    }
    if (filtros.search) {
      const q = filtros.search.toLowerCase();
      filtrados = filtrados.filter((i) =>
        i.codigo.toLowerCase().includes(q) ||
        i.produto.nome.toLowerCase().includes(q) ||
        i.origem.toLowerCase().includes(q) ||
        (i.nfLote ?? '').toLowerCase().includes(q),
      );
    }

    return filtrados.sort((a, b) =>
      fifoValor ? a.createdAt.getTime() - b.createdAt.getTime() : b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  private async lerParametroFifo(): Promise<boolean> {
    const linha = await this.db
      .select({ valorJson: parametros.valorJson })
      .from(parametros)
      .where(eq(parametros.chave, 'operacao.fifo_estoque'))
      .then((r) => r[0] ?? null);
    const valor = (linha?.valorJson as { valor?: unknown } | null)?.valor;
    return valor === true;
  }

  private async carregarProdutosPorId(produtoIds: string[]) {
    const map = new Map<string, { id: string; codigo: string; nome: string }>();
    if (produtoIds.length === 0) return map;

    const linhas = await this.db
      .select({ id: produtos.id, codigo: produtos.codigo, nome: produtos.nome })
      .from(produtos)
      .where(inArray(produtos.id, produtoIds));

    for (const linha of linhas) map.set(linha.id, linha);
    return map;
  }

  private async carregarRecebimentos(recebimentoIds: string[]) {
    const map = new Map<string, { fornecedorNome: string; romaneio: string | null; nfLote: string | null }>();
    if (recebimentoIds.length === 0) return map;

    const linhas = await this.db
      .select({
        id: recebimentos.id,
        fornecedorNome: fornecedores.razaoSocial,
        romaneio: recebimentos.romaneio,
        nfNumero: notasFiscaisFornecedor.numero,
      })
      .from(recebimentos)
      .innerJoin(fornecedores, eq(fornecedores.id, recebimentos.fornecedorId))
      .leftJoin(notasFiscaisFornecedor, eq(notasFiscaisFornecedor.recebimentoId, recebimentos.id))
      .where(inArray(recebimentos.id, recebimentoIds));

    for (const linha of linhas) {
      if (!map.has(linha.id)) {
        map.set(linha.id, {
          fornecedorNome: linha.fornecedorNome,
          romaneio: linha.romaneio,
          nfLote: linha.romaneio && linha.nfNumero ? `${linha.romaneio} / NF ${linha.nfNumero}` : linha.romaneio ?? linha.nfNumero ?? null,
        });
      }
    }
    return map;
  }

  private async carregarPedidos(pedidoVendaIds: string[]) {
    const map = new Map<string, { id: string; clienteNome: string }>();
    if (pedidoVendaIds.length === 0) return map;

    const linhas = await this.db
      .select({
        id: pedidosVenda.id,
        clienteNome: sql<string>`coalesce(${clientes.nomeFantasia}, ${clientes.razaoSocial})`,
      })
      .from(pedidosVenda)
      .innerJoin(clientes, eq(clientes.id, pedidosVenda.clienteId))
      .where(inArray(pedidosVenda.id, pedidoVendaIds));

    for (const linha of linhas) map.set(linha.id, linha);
    return map;
  }
}
