import { ROTULOS_ICMS_CST } from '../../../../database/schema/fiscal-regras.schema';

export interface LinhaExportacaoRegra {
  enquadramentoFiscal: string;
  operacaoFiscal: string;
  beneficioFiscal: string;
  classificacaoIbsCbs: string;
  operacao: string;
  icmsCst: string;
}

function celula(valor: string): string {
  if (/[;"\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

/** CSV com `;`, BOM e os rótulos do grid. Não inclui identificador técnico. */
export function montarCsvRegras(linhas: LinhaExportacaoRegra[]): string {
  const cabecalho = [
    'Enquadramento fiscal',
    'Operação fiscal (CFOP)',
    'Benefício fiscal',
    'Classificação IBS/CBS',
    'Operação',
    'Tratamento ICMS',
  ];
  const corpo = linhas.map((linha) => [
    linha.enquadramentoFiscal,
    linha.operacaoFiscal,
    linha.beneficioFiscal,
    linha.classificacaoIbsCbs,
    linha.operacao,
    ROTULOS_ICMS_CST[linha.icmsCst as keyof typeof ROTULOS_ICMS_CST] ?? linha.icmsCst,
  ].map(celula).join(';'));
  return `\uFEFF${[cabecalho.join(';'), ...corpo].join('\r\n')}`;
}
