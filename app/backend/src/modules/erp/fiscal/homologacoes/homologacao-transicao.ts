import type { SITUACOES_HOMOLOGACAO } from '../../../../database/schema/fiscal-homologacoes.schema';
import { transicaoInvalida } from '../empresas/fiscal-comum';

export type SituacaoHomologacao = (typeof SITUACOES_HOMOLOGACAO)[number];
export type AcaoHomologacao = 'aprovar' | 'rejeitar' | 'publicar' | 'vincular';

/** Ação fora da situação de origem (D8). Sem I/O. */
export function recusarDecisao(situacao: SituacaoHomologacao, acao: AcaoHomologacao): void {
  const permitida = ((acao === 'aprovar' || acao === 'rejeitar') && situacao === 'EM_REVISAO')
    || (acao === 'vincular' && (situacao === 'EM_REVISAO' || situacao === 'APROVADA'))
    || (acao === 'publicar' && situacao === 'APROVADA');
  if (!permitida) transicaoInvalida(situacao);
}
