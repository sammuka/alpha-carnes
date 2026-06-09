export type StatusNfse = 'pendente' | 'emitida' | 'erro_emissao' | 'cancelada' | 'erro_cancelamento';

const TRANSICOES_NFSE: Record<StatusNfse, StatusNfse[]> = {
  pendente:           ['emitida', 'erro_emissao'],
  emitida:            ['cancelada', 'erro_cancelamento'],
  erro_emissao:       ['pendente'],       // reprocessamento autorizado
  cancelada:          [],
  erro_cancelamento:  ['cancelada'],      // retry de cancelamento
};

export function assertTransicaoNfse(atual: StatusNfse, para: StatusNfse): void {
  if (!TRANSICOES_NFSE[atual]?.includes(para)) {
    throw new Error(`Transição de NFS-e inválida: ${atual} → ${para}`);
  }
}
