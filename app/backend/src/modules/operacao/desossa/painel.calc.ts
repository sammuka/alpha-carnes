import type { FaltaDesossaItem } from './faltas.calc';

/** Falta tip + contexto de carga para colunas Rota/Representante/Alvo (protótipo). */
export type FaltaPainelInput = FaltaDesossaItem & {
  rota: string | null;
  representante: string | null;
  horarioAlvo: string | null;
};

export type PainelRegraInput = {
  id: string;
  codigo: string | null;
  nome: string;
  provisorio: boolean;
  saidasLabel: string;
  prioridade: number;
  saidasCodigos: string[];
};

export type PainelDesossa = {
  geradoEm: string;
  modoTv: boolean;
  operacaoId: string;
  itens: Array<{
    produtoId: string;
    produtoCodigo: string;
    produtoNome: string;
    faltam: number;
    prontoEstoque: number;
    aProduzir: number;
    origem: string;
    rota: string | null;
    representante: string | null;
    horarioAlvo: string | null;
    prioridade: 'Alta' | 'Média' | 'Baixa';
    status: string;
  }>;
  regras: Array<{
    regraId: string;
    codigo: string | null;
    nome: string;
    provisorio: boolean;
    prioridade: 'Alta' | 'Média' | 'Baixa';
    tzsEstimados: number;
    saidasEsperadas: string;
    atende: string;
    sobras: string;
    impacto: string;
    status: 'Recomendada' | 'Útil' | 'Opcional';
  }>;
  alertas: Array<{ tipo: string; msg: string }>;
  totais: {
    itensFaltantes: number;
    prontoEstoque: number;
    tzsNaDesossa: number;
    pecasAProduzir: number;
  };
};

function prioridadeDe(aProduzir: number): 'Alta' | 'Média' | 'Baixa' {
  if (aProduzir >= 5) return 'Alta';
  if (aProduzir >= 2) return 'Média';
  return 'Baixa';
}

function statusDe(aProduzir: number, estoque: number): string {
  if (aProduzir <= 0 && estoque > 0) return 'Coberto por estoque';
  if (aProduzir >= 5) return 'Crítico';
  if (aProduzir >= 2) return 'Atenção';
  if (aProduzir > 0) return 'A produzir';
  return 'Aguardando TZ';
}

function prioridadeRegraLabel(n: number): 'Alta' | 'Média' | 'Baixa' {
  if (n <= 1) return 'Alta';
  if (n === 2) return 'Média';
  return 'Baixa';
}

function statusRegraDe(n: number): 'Recomendada' | 'Útil' | 'Opcional' {
  if (n <= 1) return 'Recomendada';
  if (n === 2) return 'Útil';
  return 'Opcional';
}

function atendeDe(
  itens: Array<{ produtoCodigo: string; aProduzir: number; rota: string | null }>,
  saidasCodigos: string[],
): string {
  const rotas = itens
    .filter((i) => saidasCodigos.includes(i.produtoCodigo) && i.aProduzir > 0 && i.rota)
    .map((i) => i.rota as string);
  const uniq = [...new Set(rotas)];
  return uniq[0] ?? '—';
}

function sobrasDe(
  itens: Array<{ produtoCodigo: string; produtoNome: string; prontoEstoque: number }>,
  saidasCodigos: string[],
): string {
  const cobertos = itens.filter(
    (i) => saidasCodigos.includes(i.produtoCodigo) && i.prontoEstoque > 0,
  );
  const c = cobertos[0];
  if (!c) return 'Sem sobra prevista';
  return `${c.prontoEstoque} ${c.produtoNome} p/ estoque`;
}

function impactoDe(
  itens: Array<{ produtoCodigo: string; produtoNome: string; aProduzir: number }>,
  saidasCodigos: string[],
): string {
  const nomes = itens
    .filter((i) => saidasCodigos.includes(i.produtoCodigo) && i.aProduzir > 0)
    .map((i) => i.produtoNome);
  if (nomes.length === 0) return 'Sem demanda ativa coberta';
  return `Cobre ${nomes.join(' e ')}`;
}

/**
 * Tip: quantidadeFaltante já líquido (faltas.calc.ts:41).
 * UI protótipo: faltam = demanda bruta; aProduzir = líquido.
 */
export function montarPainelDesossa(input: {
  faltas: FaltaPainelInput[];
  regras: PainelRegraInput[];
  modoTv: boolean;
  geradoEm: string;
  tzsNaDesossa: number;
  operacaoId: string;
}): PainelDesossa {
  const itens = input.faltas.map((f) => {
    const aProduzir = Math.max(0, f.quantidadeFaltante);
    const faltam = aProduzir + Math.max(0, f.quantidadeEstoque);
    return {
      produtoId: f.produto.id,
      produtoCodigo: f.produto.codigo,
      produtoNome: f.produto.nome,
      faltam,
      prontoEstoque: f.quantidadeEstoque,
      aProduzir,
      origem: f.origem,
      rota: f.rota,
      representante: f.representante,
      horarioAlvo: f.horarioAlvo,
      prioridade: prioridadeDe(aProduzir),
      status: statusDe(aProduzir, f.quantidadeEstoque),
    };
  });

  const totais = {
    itensFaltantes: itens.filter((i) => i.aProduzir > 0 || i.faltam > 0).length,
    prontoEstoque: itens.reduce((acc, i) => acc + i.prontoEstoque, 0),
    tzsNaDesossa: input.tzsNaDesossa,
    pecasAProduzir: itens.reduce((acc, i) => acc + i.aProduzir, 0),
  };

  const alertas: PainelDesossa['alertas'] = [];
  const criticos = itens.filter((i) => i.status === 'Crítico');
  if (criticos.length > 0) {
    alertas.push({
      tipo: 'Crítico',
      msg: `${criticos.length} item(ns) crítico(s) na desossa — priorizar TZ`,
    });
  }

  const regras = input.modoTv
    ? []
    : input.regras.map((r) => ({
        regraId: r.id,
        codigo: r.codigo,
        nome: r.nome,
        provisorio: r.provisorio,
        prioridade: prioridadeRegraLabel(r.prioridade),
        tzsEstimados: Math.ceil(totais.pecasAProduzir / 2) || 0,
        saidasEsperadas: r.saidasLabel,
        atende: atendeDe(itens, r.saidasCodigos),
        sobras: sobrasDe(itens, r.saidasCodigos),
        impacto: impactoDe(itens, r.saidasCodigos),
        status: statusRegraDe(r.prioridade),
      }));

  return {
    geradoEm: input.geradoEm,
    modoTv: input.modoTv,
    operacaoId: input.operacaoId,
    itens,
    regras,
    alertas,
    totais,
  };
}
