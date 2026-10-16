'use client';

import { rotuloVersao, simulacoesApi, type DetalheSimulacao } from '@/lib/fiscal-simulacoes';
import { CompararVersoesDialog } from '../comum/comparar-versoes-dialog';

interface Props {
  aberto: boolean;
  detalhe: DetalheSimulacao | null;
  onFechar: () => void;
}

/** Compara a versão aberta com outra versão do mesmo código (código, versão, situação e competência no rótulo). */
export function CompararDialog({ aberto, detalhe, onFechar }: Props) {
  if (!detalhe) return null;
  return (
    <CompararVersoesDialog
      aberto={aberto}
      titulo="Comparar versões"
      onFechar={onFechar}
      carregarOpcoes={async () => (await simulacoesApi.versoesDoCodigo(detalhe.codigo))
        .filter((versao) => versao.id !== detalhe.id)
        .sort((a, b) => a.numeroVersao - b.numeroVersao)
        .map((versao) => ({ id: versao.id, rotulo: rotuloVersao(versao) }))}
      comparar={async (outraId) => (await simulacoesApi.comparar(detalhe.id, outraId)).diferencas}
    />
  );
}
