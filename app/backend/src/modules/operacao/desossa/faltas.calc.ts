export interface ProdutoSaidaTransformacao {
  id: string;
  codigo: string;
  nome: string;
  legadoItemComercialId: string | null;
}

export interface FaltaDesossaItem {
  produto: { id: string; codigo: string; nome: string };
  quantidadeFaltante: number;
  quantidadeEstoque: number;
  origem: string;
}

/** Converte numeric/string do banco para número finito (default 0). */
export function parseQuantidade(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const n = typeof valor === 'number' ? valor : Number.parseFloat(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Calcula faltas da desossa: demanda pendente em pedidos (produtos saida_transformacao)
 * menos quantidade pronta em estoque (em_sobra), agrupada por produto.
 */
export function calcularFaltasDesossa(
  produtos: ProdutoSaidaTransformacao[],
  demandaPorItemComercial: ReadonlyMap<string, number>,
  estoquePorItemComercial: ReadonlyMap<string, number>,
  origemPorProdutoId: ReadonlyMap<string, string>,
): FaltaDesossaItem[] {
  const itens: FaltaDesossaItem[] = [];

  for (const produto of produtos) {
    if (!produto.legadoItemComercialId) continue;

    const demanda = demandaPorItemComercial.get(produto.legadoItemComercialId) ?? 0;
    if (demanda <= 0) continue;

    const estoque = estoquePorItemComercial.get(produto.legadoItemComercialId) ?? 0;
    const faltante = Math.max(0, demanda - estoque);

    itens.push({
      produto: { id: produto.id, codigo: produto.codigo, nome: produto.nome },
      quantidadeFaltante: faltante,
      quantidadeEstoque: estoque,
      origem: origemPorProdutoId.get(produto.id) ?? 'TZ',
    });
  }

  return itens.sort((a, b) => b.quantidadeFaltante - a.quantidadeFaltante);
}
