'use client';

import { regrasApi, rotuloVersao, type DetalheRegra } from '@/lib/fiscal-regras';
import { CompararVersoesDialog } from '../comum/comparar-versoes-dialog';

interface Props {
  aberto: boolean;
  detalhe: DetalheRegra | null;
  onFechar: () => void;
}

/** Compara a versão aberta com outra versão do mesmo código (código, versão e situação no rótulo). */
export function CompararDialog({ aberto, detalhe, onFechar }: Props) {
  if (!detalhe) return null;
  return (
    <CompararVersoesDialog
      aberto={aberto}
      titulo="Comparar"
      onFechar={onFechar}
      carregarOpcoes={async () => (await regrasApi.versoesDoCodigo(detalhe.codigo))
        .filter((versao) => versao.id !== detalhe.id)
        .sort((a, b) => a.numeroVersao - b.numeroVersao)
        .map((versao) => ({ id: versao.id, rotulo: rotuloVersao(versao) }))}
      comparar={async (outraId) => (await regrasApi.comparar(detalhe.id, outraId)).diferencas}
    />
  );
}
