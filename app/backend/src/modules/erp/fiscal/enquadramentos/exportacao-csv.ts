const ROTULOS_TP_NF: Record<string, string> = { '0': 'Entrada', '1': 'Saída' };
const ROTULOS_FIN_NFE: Record<string, string> = {
  '1': 'Operação normal',
  '2': 'NF-e complementar',
  '3': 'NF-e de ajuste',
  '4': 'Devolução',
};
const ROTULOS_ABRANGENCIA: Record<string, string> = {
  INTERNA: 'Dentro do estado',
  INTER: 'Outro estado',
  EXT: 'Exterior',
};
const ROTULOS_TIPO_PRODUTO: Record<string, string> = {
  PROPRIA: 'Produção própria',
  REVENDA: 'Revenda',
  SUB: 'Subproduto',
};
const ROTULOS_SITUACAO: Record<string, string> = {
  ATIVA: 'Ativa',
  INATIVA: 'Inativa',
};

export interface LinhaExportacaoEnquadramento {
  codigo: string;
  operacao: string;
  cfop: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  estabelecimento: string;
  tpNf: string;
  finNfe: string;
  situacao: string;
  responsavel: string;
  produto: string;
  cliente: string;
  ncm: string;
  cest: string;
  prioridade: number;
  abrangencia: string;
  tipoProduto: string;
}

/** CFOP 9.999, NCM 9999.99.99 e CEST 99.999.99: texto mascarado, o Excel não descarta zeros à esquerda. */
export function mascararCfop(codigo: string): string {
  return /^[0-9]{4}$/.test(codigo) ? `${codigo[0]}.${codigo.slice(1)}` : codigo;
}
export function mascararNcm(codigo: string): string {
  return /^[0-9]{8}$/.test(codigo) ? `${codigo.slice(0, 4)}.${codigo.slice(4, 6)}.${codigo.slice(6)}` : codigo;
}
export function mascararCest(codigo: string): string {
  return /^[0-9]{7}$/.test(codigo) ? `${codigo.slice(0, 2)}.${codigo.slice(2, 5)}.${codigo.slice(5)}` : codigo;
}

/** ISO (aaaa-mm-dd) para dd/MM/aaaa, como a tela. */
function dataBr(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '');
}

function celula(original: string): string {
  // Injeção de fórmula (OWASP): texto iniciado por = + - @ tab ou CR vira literal no Excel.
  const valor = /^[=+\-@\t\r]/.test(original) ? `'${original}` : original;
  if (/[;"\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

/** CSV com `;`, BOM e os rótulos da tela. Não inclui identificadores. */
export function montarCsvEnquadramentos(linhas: LinhaExportacaoEnquadramento[]): string {
  const cabecalho = [
    'Código',
    'Operação',
    'Operação fiscal (CFOP)',
    'Início de vigência',
    'Fim de vigência',
    'Estabelecimento',
    'Tipo da nota',
    'Finalidade',
    'Situação',
    'Responsável',
    'Produto',
    'Cliente',
    'Classificação fiscal (NCM)',
    'Substituição tributária (CEST)',
    'Prioridade',
    'Abrangência da operação',
    'Origem do produto',
  ];
  const corpo = linhas.map((linha) => [
    linha.codigo,
    linha.operacao,
    mascararCfop(linha.cfop),
    dataBr(linha.vigenciaInicio),
    dataBr(linha.vigenciaFim),
    linha.estabelecimento,
    ROTULOS_TP_NF[linha.tpNf] ?? linha.tpNf,
    ROTULOS_FIN_NFE[linha.finNfe] ?? linha.finNfe,
    ROTULOS_SITUACAO[linha.situacao] ?? linha.situacao,
    linha.responsavel,
    linha.produto,
    linha.cliente,
    mascararNcm(linha.ncm),
    mascararCest(linha.cest),
    String(linha.prioridade),
    ROTULOS_ABRANGENCIA[linha.abrangencia] ?? linha.abrangencia,
    ROTULOS_TIPO_PRODUTO[linha.tipoProduto] ?? linha.tipoProduto,
  ].map(celula).join(';'));
  return `\uFEFF${[cabecalho.join(';'), ...corpo].join('\r\n')}`;
}
