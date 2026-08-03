export type StatusSeguro = 'pendente' | 'enviado' | 'confirmado';

const TRANSICOES_SEGURO: Record<StatusSeguro, StatusSeguro[]> = {
  pendente:   ['enviado'],
  enviado:    ['confirmado', 'pendente'], // regressão auditada (D10.5)
  confirmado: [], // terminal — correção = soft delete + novo registro
};

export function assertTransicaoSeguro(atual: StatusSeguro, para: StatusSeguro): void {
  if (!TRANSICOES_SEGURO[atual]?.includes(para)) {
    throw new Error(`Transição de seguro inválida: ${atual} → ${para}`);
  }
}
