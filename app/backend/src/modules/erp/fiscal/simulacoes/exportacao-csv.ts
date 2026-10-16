export interface LinhaCsvMemoria {
  rotulo: string;
  valor: string;
}

export interface LinhaCsvGrade {
  cliente: string;
  produto: string;
  valor: string;
  valorLiquido: string;
  estabelecimento: string;
  operacao: string;
}

function celula(original: string): string {
  // Injeção de fórmula (OWASP): texto iniciado por = + - @ tab ou CR vira literal no Excel.
  const valor = /^[=+\-@\t\r]/.test(original) ? `'${original}` : original;
  if (/[;"\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

function documento(cabecalho: string, linhas: string[]): string {
  return `\uFEFF${[cabecalho, ...linhas].join('\r\n')}`;
}

/**
 * CSV da explicação (D11, §7), na ordem de /explicacao: linhas, tratamento sem alíquota com a frase,
 * parágrafo da base diferente (quando há) e referência legal. A frase vai entre aspas por causa do `;`.
 */
export function montarCsvMemoria(entrada: {
  linhas: LinhaCsvMemoria[];
  semAliquota: Array<{ rotulo: string; tratamento: string; texto: string }>;
  textoBase: string | null;
  referenciaLegal: string;
}): string {
  const pares = [
    ...entrada.linhas.map((linha) => [linha.rotulo, linha.valor]),
    ...entrada.semAliquota.map((linha) => [linha.rotulo, `${linha.tratamento}. ${linha.texto}`]),
    ...(entrada.textoBase ? [['Base tributável difere de valor bruto', entrada.textoBase]] : []),
    ['Referência legal', entrada.referenciaLegal],
  ];
  return documento('Campo;Valor', pares.map((par) => par.map(celula).join(';')));
}

/** CSV da grade. Não inclui identificador técnico. */
export function montarCsvGrade(linhas: LinhaCsvGrade[]): string {
  const corpo = linhas.map((linha) => [
    linha.cliente,
    linha.produto,
    linha.valor,
    linha.valorLiquido,
    linha.estabelecimento,
    linha.operacao,
  ].map(celula).join(';'));
  return documento(
    'Cliente;Produto;Valor;Valor líquido (calculado);Estabelecimento;Operação',
    corpo,
  );
}
