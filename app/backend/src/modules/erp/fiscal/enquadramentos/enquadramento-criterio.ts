export type Intervalo = { inicio: string; fim: string | null };

export function intervalosSobrepoem(a: Intervalo, b: Intervalo): boolean {
  const fimA = a.fim ?? '9999-12-31';
  const fimB = b.fim ?? '9999-12-31';
  return a.inicio <= fimB && b.inicio <= fimA;
}

export type ChaveEnquadramento = {
  operacaoId: string;
  tpNf: string;
  finNfe: string;
  cfopId: string;
  abrangencia: string;
  tipoProduto: string;
  produtoId: string;
  ncmId: string;
  cest: string;
  clienteId: string;
};

export type Candidato = { codigo: string; prioridade: number };

export type Classificacao =
  | { tipo: 'ausente' }
  | { tipo: 'unico'; codigo: string }
  | { tipo: 'empate'; codigos: string[] };

/** H-E01-07: não lê prioridade e não elege vencedor. */
export function classificarEnquadramentos(candidatos: readonly Candidato[]): Classificacao {
  if (candidatos.length === 0) return { tipo: 'ausente' };
  if (candidatos.length === 1) return { tipo: 'unico', codigo: candidatos[0]!.codigo };
  return { tipo: 'empate', codigos: candidatos.map((c) => c.codigo) };
}

export function mesmaChave(a: ChaveEnquadramento, b: ChaveEnquadramento): boolean {
  return a.operacaoId === b.operacaoId
    && a.tpNf === b.tpNf
    && a.finNfe === b.finNfe
    && a.cfopId === b.cfopId
    && a.abrangencia === b.abrangencia
    && a.tipoProduto === b.tipoProduto
    && a.produtoId === b.produtoId
    && a.ncmId === b.ncmId
    && a.cest === b.cest
    && a.clienteId === b.clienteId;
}
