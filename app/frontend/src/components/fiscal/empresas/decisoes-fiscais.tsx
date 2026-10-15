import {
  fiscalApi,
  formatarDataIso,
  rotuloRegime,
  type AlteracaoAberta,
  type EstabelecimentoDetalhe,
  type RegimeVersao,
} from '@/lib/fiscal-empresas';
import type { DecisaoPendente } from './decisao-dialog';

/**
 * Fábricas das decisões (diálogo com justificativa) sobre estabelecimento, regime e alteração.
 * Cada uma carrega a `versao` lida no detalhe: a concorrência otimista é decidida pelo backend.
 */

type AcaoEstabelecimento = 'submeter' | 'aprovar' | 'rejeitar' | 'suspender' | 'reativar';

const TEXTOS_ESTABELECIMENTO: Record<AcaoEstabelecimento, { titulo: string; rotulo: string; sucesso: string; perigosa?: boolean }> = {
  submeter: { titulo: 'Enviar para revisão', rotulo: 'Enviar para revisão', sucesso: 'Estabelecimento enviado para revisão.' },
  aprovar: { titulo: 'Aprovar estabelecimento', rotulo: 'Aprovar', sucesso: 'Estabelecimento aprovado.' },
  rejeitar: { titulo: 'Rejeitar estabelecimento', rotulo: 'Rejeitar', sucesso: 'Estabelecimento rejeitado.', perigosa: true },
  suspender: { titulo: 'Suspender estabelecimento', rotulo: 'Suspender', sucesso: 'Estabelecimento suspenso.', perigosa: true },
  reativar: { titulo: 'Reativar estabelecimento', rotulo: 'Reativar para revisão', sucesso: 'Estabelecimento reativado para revisão.' },
};

export function decisaoEstabelecimento(det: EstabelecimentoDetalhe, acao: AcaoEstabelecimento): DecisaoPendente {
  const t = TEXTOS_ESTABELECIMENTO[acao];
  return {
    titulo: t.titulo,
    detalhe: `${det.nome} — registre a justificativa da decisão.`,
    rotuloConfirmar: t.rotulo,
    perigosa: t.perigosa,
    mensagemSucesso: t.sucesso,
    executar: (justificativa) => fiscalApi.acaoEstabelecimento(det.id, acao, { versao: det.versao, justificativa }),
  };
}

export function decisaoRemoverEstabelecimento(det: EstabelecimentoDetalhe): DecisaoPendente {
  return {
    titulo: 'Remover estabelecimento',
    detalhe: `${det.nome} sairá das listas. Só é possível sem regime em revisão ou aprovado.`,
    rotuloConfirmar: 'Remover',
    perigosa: true,
    mensagemSucesso: 'Estabelecimento removido.',
    executar: (justificativa) => fiscalApi.removerEstabelecimento(det.id, justificativa),
  };
}

type AcaoRegime = 'submeter' | 'aprovar' | 'rejeitar';

const TEXTOS_REGIME: Record<AcaoRegime, { titulo: string; rotulo: string; sucesso: string; perigosa?: boolean }> = {
  submeter: { titulo: 'Enviar regime para revisão', rotulo: 'Enviar para revisão', sucesso: 'Regime enviado para revisão.' },
  aprovar: { titulo: 'Aprovar regime tributário', rotulo: 'Aprovar', sucesso: 'Regime aprovado.' },
  rejeitar: { titulo: 'Rejeitar regime tributário', rotulo: 'Rejeitar', sucesso: 'Regime rejeitado.', perigosa: true },
};

function descricaoRegime(regime: RegimeVersao): string {
  return `${rotuloRegime(regime)}, a partir de ${formatarDataIso(regime.vigenciaInicio)}`;
}

export function decisaoRegime(det: EstabelecimentoDetalhe, regime: RegimeVersao, acao: AcaoRegime): DecisaoPendente {
  const t = TEXTOS_REGIME[acao];
  return {
    titulo: t.titulo,
    detalhe: `${descricaoRegime(regime)}.`,
    rotuloConfirmar: t.rotulo,
    perigosa: t.perigosa,
    mensagemSucesso: t.sucesso,
    // `confirmarTroca` só é enviado depois do challenge 409 de troca de regime.
    executar: (justificativa, confirmarTroca) =>
      fiscalApi.acaoRegime(det.id, regime.id, acao, {
        versao: regime.versao,
        justificativa,
        ...(acao === 'submeter' && confirmarTroca ? { confirmarTroca: true } : {}),
      }),
  };
}

export function decisaoRemoverRegime(det: EstabelecimentoDetalhe, regime: RegimeVersao): DecisaoPendente {
  return {
    titulo: 'Remover versão de regime',
    detalhe: `${descricaoRegime(regime)}.`,
    rotuloConfirmar: 'Remover',
    perigosa: true,
    mensagemSucesso: 'Versão de regime removida.',
    executar: (justificativa) => fiscalApi.removerRegime(det.id, regime.id, justificativa),
  };
}

type AcaoAlteracao = 'submeter' | 'aprovar' | 'rejeitar';

const TEXTOS_ALTERACAO: Record<AcaoAlteracao, { titulo: string; rotulo: string; sucesso: string; perigosa?: boolean }> = {
  submeter: { titulo: 'Enviar alteração para revisão', rotulo: 'Enviar para revisão', sucesso: 'Alteração enviada para revisão.' },
  aprovar: { titulo: 'Aprovar alteração', rotulo: 'Aprovar alteração', sucesso: 'Alteração aprovada e aplicada ao cadastro.' },
  rejeitar: { titulo: 'Rejeitar alteração', rotulo: 'Rejeitar alteração', sucesso: 'Alteração rejeitada; o cadastro aprovado foi mantido.', perigosa: true },
};

export function decisaoAlteracao(det: EstabelecimentoDetalhe, alt: AlteracaoAberta, acao: AcaoAlteracao): DecisaoPendente {
  const t = TEXTOS_ALTERACAO[acao];
  return {
    titulo: t.titulo,
    detalhe: `Proposta para ${det.nome}.`,
    rotuloConfirmar: t.rotulo,
    perigosa: t.perigosa,
    mensagemSucesso: t.sucesso,
    executar: (justificativa) => fiscalApi.acaoAlteracao(det.id, alt.id, acao, { versao: alt.versao, justificativa }),
  };
}

export function decisaoDescartarAlteracao(det: EstabelecimentoDetalhe, alt: AlteracaoAberta): DecisaoPendente {
  return {
    titulo: 'Descartar alteração',
    detalhe: `A proposta para ${det.nome} será descartada; o cadastro aprovado continua como está.`,
    rotuloConfirmar: 'Descartar',
    perigosa: true,
    mensagemSucesso: 'Alteração descartada.',
    executar: (justificativa) => fiscalApi.descartarAlteracao(det.id, alt.id, justificativa),
  };
}
