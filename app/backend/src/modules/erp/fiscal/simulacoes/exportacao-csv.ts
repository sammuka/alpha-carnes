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

/** CSV da explicação. A frase sem alíquota vai na coluna Valor, entre aspas por causa do `;`. */
export function montarCsvMemoria(entrada: {
  linhas: LinhaCsvMemoria[];
  semAliquota: Array<{ rotulo: string; texto: string }>;
}): string {
  const pares = [
    ...entrada.linhas.map((linha) => [linha.rotulo, linha.valor]),
    ...entrada.semAliquota.map((linha) => [linha.rotulo, linha.texto]),
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
