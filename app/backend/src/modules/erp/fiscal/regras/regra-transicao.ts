import { conflito, transicaoInvalida } from '../empresas/fiscal-comum';
import type { SITUACOES_REGRA } from '../../../../database/schema/fiscal-regras.schema';

export type SituacaoRegra = (typeof SITUACOES_REGRA)[number];
export type AcaoCiclo = 'submeter' | 'aprovar' | 'aposentar' | 'adicionarVersao';

const MENSAGEM_IMUTAVEL = 'Versão aprovada ou aposentada não pode ser alterada. Inclua uma versão nova.';

/** Edição de campos. Rascunho segue. Submetida e decidida recusam. */
export function recusarEdicao(situacao: SituacaoRegra): void {
  if (situacao === 'APROVADA' || situacao === 'APOSENTADA') {
    conflito('VERSAO_IMUTAVEL', MENSAGEM_IMUTAVEL);
  }
  if (situacao !== 'RASCUNHO') transicaoInvalida(situacao);
}

/** Ação de ciclo fora da situação de origem. */
export function recusarAcao(situacao: SituacaoRegra, acao: AcaoCiclo): void {
  const permitida = (acao === 'submeter' && situacao === 'RASCUNHO')
    || (acao === 'aprovar' && situacao === 'SUBMETIDA')
    || (acao === 'aposentar' && situacao === 'APROVADA')
    || (acao === 'adicionarVersao' && (situacao === 'APROVADA' || situacao === 'APOSENTADA'));
  if (!permitida) transicaoInvalida(situacao);
}
