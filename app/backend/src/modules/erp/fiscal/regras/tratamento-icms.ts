import { regraViolada } from '../empresas/fiscal-comum';

/** Razão canônica ("0.4167") ou o texto do numeric do banco; zero em qualquer escala. */
function zero(razao: string): boolean {
  return Number(razao) === 0;
}

/**
 * AD-34 (fail-closed, semântica legal do tratamento ICMS): Tributação integral sem redução; Redução de base
 * com redução maior que zero; Isenção e Não tributada sem redução e sem alíquota. Diferimento não tem
 * tratamento definido nas fontes: o rascunho existe; submissão, aprovação e cálculo recusam.
 */
export function exigirTratamentoIcmsCoerente(
  regra: { icmsCst: string; pRedBc: string; pIcms: string },
  etapa: 'rascunho' | 'aprovacao' /* aprovacao = submissão, aprovação e cálculo */ = 'rascunho',
): void {
  const { icmsCst, pRedBc, pIcms } = regra;
  if (icmsCst === '00' && !zero(pRedBc)) {
    regraViolada('TRATAMENTO_ICMS_INCOERENTE', 'Tributação integral não admite redução de base do ICMS. Informe redução 0,00.');
  }
  if (icmsCst === '20' && zero(pRedBc)) {
    regraViolada('TRATAMENTO_ICMS_INCOERENTE', 'A redução de base de cálculo do ICMS deve ser maior que 0,00 para este tratamento.');
  }
  if ((icmsCst === '40' || icmsCst === '41') && (!zero(pRedBc) || !zero(pIcms))) {
    const rotulo = icmsCst === '40' ? 'Isenção' : 'Não tributada';
    regraViolada('TRATAMENTO_ICMS_INCOERENTE', `${rotulo} não calcula ICMS. Informe redução de base e alíquota 0,00.`);
  }
  if (etapa === 'aprovacao' && icmsCst === '51') {
    regraViolada(
      'TRATAMENTO_ICMS_PENDENTE',
      'O tratamento do diferimento do ICMS está pendente de decisão. A regra permanece em rascunho: não pode ser submetida, aprovada nem usada no cálculo.',
    );
  }
}
