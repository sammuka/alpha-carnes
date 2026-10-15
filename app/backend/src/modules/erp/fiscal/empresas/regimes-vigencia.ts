/** Intervalo fechado de vigência usado na classificação (D8). `vigenciaFim` nulo significa em aberto. */
export interface IntervaloRegime {
  id: string;
  crt: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  situacao: string;
}

export type ClassificacaoRegime =
  | { tipo: 'livre' }
  | { tipo: 'troca'; regimeAtual: IntervaloRegime; fimProposto: string; semRegimeAPartirDe: string | null }
  | { tipo: 'sobreposto'; conflito: Pick<IntervaloRegime, 'crt' | 'vigenciaInicio' | 'vigenciaFim' | 'situacao'> };

function deslocarDia(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(ano!, (mes ?? 1) - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Dia civil anterior, em UTC, sobre `YYYY-MM-DD`. */
export function diaAnterior(iso: string): string {
  return deslocarDia(iso, -1);
}

function fimEfetivo(fim: string | null): string {
  return fim ?? '9999-12-31';
}

function cruza(
  inicioA: string,
  fimA: string | null,
  inicioB: string,
  fimB: string | null,
): boolean {
  return inicioA <= fimEfetivo(fimB) && inicioB <= fimEfetivo(fimA);
}

/**
 * Classifica a nova vigência contra regimes REVIEW/APPROVED do mesmo estabelecimento,
 * já sem a própria linha. Troca só encurta um APPROVED ainda aberto.
 */
export function classificarSobreposicao(
  nova: { vigenciaInicio: string; vigenciaFim: string | null },
  existentes: IntervaloRegime[],
): ClassificacaoRegime {
  const cruzados = existentes.filter((existente) =>
    cruza(nova.vigenciaInicio, nova.vigenciaFim, existente.vigenciaInicio, existente.vigenciaFim),
  );
  if (cruzados.length === 0) return { tipo: 'livre' };
  const unico = cruzados[0];
  if (
    cruzados.length === 1
    && unico
    && unico.situacao === 'APPROVED'
    && unico.vigenciaFim === null
    && unico.vigenciaInicio < nova.vigenciaInicio
  ) {
    return {
      tipo: 'troca',
      regimeAtual: unico,
      fimProposto: diaAnterior(nova.vigenciaInicio),
      // Regra D8 inalterada: a anterior fecha em D−1 mesmo que a nova tenha fim; depois dele fica sem regime.
      semRegimeAPartirDe: nova.vigenciaFim && nova.vigenciaFim < '9999-12-31' ? deslocarDia(nova.vigenciaFim, 1) : null,
    };
  }
  const conflito = unico ?? cruzados[0]!;
  return {
    tipo: 'sobreposto',
    conflito: {
      crt: conflito.crt,
      vigenciaInicio: conflito.vigenciaInicio,
      vigenciaFim: conflito.vigenciaFim,
      situacao: conflito.situacao,
    },
  };
}
