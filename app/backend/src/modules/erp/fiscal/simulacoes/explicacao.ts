import { ROTULOS_IBS_CST, ROTULOS_ICMS_CST, ROTULOS_IPI_CST, ROTULOS_PIS_CST } from '../../../../database/schema/fiscal-regras.schema';
import { formatarPercentualPtBr } from '../regras/percentual';
import { formatarDinheiroPtBr, formatarEscalaPtBr, rotuloCompetencia } from './decimal-memoria';

export const FRASE_SEM_ALIQUOTA = 'Esta regra não guarda alíquota deste tributo; nenhum valor é calculado.';

export interface LinhaExplicacao {
  rotulo: string;
  valor: string;
}

export interface SemAliquota {
  rotulo: string;
  tratamento: string;
  texto: string;
}

export interface ExplicacaoEntrada {
  cliente: string;
  produto: string;
  estabelecimento: string;
  operacao: string;
  ncm: string;
  quantidade: string;
  pesoNf: string;
  valor: string;
  desconto: string;
  valorLiquido: string;
  competencia: string;
  enquadramento: string;
  regraCodigo: string;
  regraNumeroVersao: number;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  icmsCst: string;
  pRedBc: string;
  baseTributavel: string;
  pIcms: string;
  icms: string;
  ipiCst: string;
  pisCst: string;
  ibsCst: string;
  beneficio: string;
  classificacao: string;
  baseDifereBruto: boolean;
}

function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function textoDaBase(entrada: Pick<ExplicacaoEntrada, 'valor' | 'desconto' | 'valorLiquido' | 'pRedBc' | 'baseTributavel' | 'baseDifereBruto'>): string | null {
  if (!entrada.baseDifereBruto) return null;
  return `A base tributável difere do valor bruto. Valor: ${formatarDinheiroPtBr(entrada.valor)}. Desconto: ${formatarDinheiroPtBr(entrada.desconto)}. Valor líquido (calculado): ${formatarDinheiroPtBr(entrada.valorLiquido)}. Redução de base do ICMS (%): ${formatarPercentualPtBr(entrada.pRedBc)}. Base tributável (calculada): ${formatarDinheiroPtBr(entrada.baseTributavel)}.`;
}

export function montarExplicacao(entrada: ExplicacaoEntrada) {
  const fim = entrada.vigenciaFim ? dataBr(entrada.vigenciaFim) : 'Sem fim de vigência';
  const inicio = dataBr(entrada.vigenciaInicio);
  const linhas: LinhaExplicacao[] = [
    { rotulo: 'Cliente', valor: entrada.cliente },
    { rotulo: 'Produto', valor: entrada.produto },
    { rotulo: 'Estabelecimento', valor: entrada.estabelecimento },
    { rotulo: 'Operação', valor: entrada.operacao },
    { rotulo: 'Classificação fiscal (NCM)', valor: entrada.ncm },
    { rotulo: 'Quantidade', valor: formatarEscalaPtBr(entrada.quantidade) },
    { rotulo: 'Peso informado na nota (kg)', valor: formatarEscalaPtBr(entrada.pesoNf) },
    { rotulo: 'Valor', valor: formatarDinheiroPtBr(entrada.valor) },
    { rotulo: 'Desconto', valor: formatarDinheiroPtBr(entrada.desconto) },
    { rotulo: 'Valor líquido (calculado)', valor: formatarDinheiroPtBr(entrada.valorLiquido) },
    { rotulo: 'Competência', valor: rotuloCompetencia(entrada.competencia) },
    { rotulo: 'Enquadramento fiscal', valor: entrada.enquadramento },
    { rotulo: 'Código da regra', valor: entrada.regraCodigo },
    { rotulo: 'Versão da regra', valor: String(entrada.regraNumeroVersao) },
    { rotulo: 'Início de vigência', valor: inicio },
    { rotulo: 'Fim de vigência', valor: fim },
    { rotulo: 'Tratamento ICMS', valor: ROTULOS_ICMS_CST[entrada.icmsCst as keyof typeof ROTULOS_ICMS_CST] },
    { rotulo: 'Redução de base do ICMS (%)', valor: formatarPercentualPtBr(entrada.pRedBc) },
    { rotulo: 'Base tributável (calculada)', valor: formatarDinheiroPtBr(entrada.baseTributavel) },
    { rotulo: 'Alíquota (%)', valor: formatarPercentualPtBr(entrada.pIcms) },
    { rotulo: 'ICMS', valor: formatarDinheiroPtBr(entrada.icms) },
  ];
  const semAliquota: SemAliquota[] = [
    { rotulo: 'Tratamento IPI', tratamento: ROTULOS_IPI_CST[entrada.ipiCst as keyof typeof ROTULOS_IPI_CST], texto: FRASE_SEM_ALIQUOTA },
    { rotulo: 'Tratamento PIS/COFINS', tratamento: ROTULOS_PIS_CST[entrada.pisCst as keyof typeof ROTULOS_PIS_CST], texto: FRASE_SEM_ALIQUOTA },
    { rotulo: 'Tratamento IBS/CBS', tratamento: ROTULOS_IBS_CST[entrada.ibsCst as keyof typeof ROTULOS_IBS_CST], texto: FRASE_SEM_ALIQUOTA },
  ];
  return {
    linhas,
    semAliquota,
    referenciaLegal: `Regra ${entrada.regraCodigo} versão ${entrada.regraNumeroVersao}, vigência de ${inicio} a ${fim}. Benefício fiscal: ${entrada.beneficio}. Classificação IBS/CBS: ${entrada.classificacao}.`,
    textoBase: textoDaBase(entrada),
  };
}
