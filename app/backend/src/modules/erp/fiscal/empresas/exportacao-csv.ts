const ROTULOS_SITUACAO: Record<string, string> = {
  DRAFT: 'Rascunho',
  REVIEW: 'Em revisão',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  SUSPENDED: 'Suspenso',
};

const ROTULOS_CRT: Record<string, string> = {
  '1': 'Simples Nacional',
  '2': 'Simples Nacional — sublimite',
  '3': 'Regime normal',
  '4': 'MEI',
};

export interface LinhaExportacaoFiscal {
  nome: string;
  cnpj: string;
  crt: string | null;
  uf: string;
  situacao: string;
  empresa: string;
}

function celula(original: string): string {
  // Injeção de fórmula (OWASP): texto iniciado por = + - @ tab ou CR vira literal no Excel.
  const valor = /^[=+\-@\t\r]/.test(original) ? `'${original}` : original;
  if (/[;"\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

/** CSV com `;`, BOM e rótulos. Não inclui identificadores. */
export function montarCsvEstabelecimentos(linhas: LinhaExportacaoFiscal[]): string {
  const cabecalho = ['Estabelecimento', 'CNPJ', 'Regime tributário', 'Estado', 'Situação', 'Empresa'];
  const corpo = linhas.map((linha) => [
    linha.nome,
    linha.cnpj,
    linha.crt ? (ROTULOS_CRT[linha.crt] ?? '') : '',
    linha.uf,
    ROTULOS_SITUACAO[linha.situacao] ?? linha.situacao,
    linha.empresa,
  ].map(celula).join(';'));
  return `\uFEFF${[cabecalho.join(';'), ...corpo].join('\r\n')}`;
}
