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

/** Máscara exibida na grade (12.ABC.345/0001-35): o Excel trata como texto, sem perder zeros nem virar notação científica. */
export function mascararCnpj(cnpj: string): string {
  return cnpj.length === 14
    ? `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
    : cnpj;
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
    mascararCnpj(linha.cnpj),
    linha.crt ? (ROTULOS_CRT[linha.crt] ?? '') : '',
    linha.uf,
    ROTULOS_SITUACAO[linha.situacao] ?? linha.situacao,
    linha.empresa,
  ].map(celula).join(';'));
  return `\uFEFF${[cabecalho.join(';'), ...corpo].join('\r\n')}`;
}
