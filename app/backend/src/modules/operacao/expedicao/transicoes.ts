import { ConflictException } from '@nestjs/common';

// Status do caminhão (plano → ativo → conferência → fechado → faturamento)
export type StatusCaminhao =
  | 'planejado'
  | 'aguardando_carga'
  | 'em_carga'
  | 'em_conferencia'
  | 'fechado'
  | 'liberado_faturamento'
  | 'faturado'
  | 'liberado_saida'
  | 'expedido';

// Transições permitidas F5 (F6 abrirá faturado/liberado_saida/expedido)
const TRANSICOES: Record<StatusCaminhao, StatusCaminhao[]> = {
  planejado:              ['aguardando_carga'],
  aguardando_carga:       ['em_carga'],
  em_carga:               ['em_conferencia'],
  em_conferencia:         ['fechado', 'em_carga'], // em_carga = reabertura parcial de conferência
  fechado:                ['liberado_faturamento', 'em_carga'], // em_carga = reabertura de expedição (EXPEDICAO_REABRIR)
  liberado_faturamento:   ['faturado'],             // F6
  faturado:               ['liberado_saida'],        // F6
  liberado_saida:         ['expedido'],              // F6
  expedido:               [],
};

/** Lança 409 se a transição não for permitida. */
export function assertTransicao(de: StatusCaminhao, para: StatusCaminhao): void {
  const permitidos = TRANSICOES[de] ?? [];
  if (!permitidos.includes(para)) {
    throw new ConflictException(
      `Transição inválida: ${de} → ${para}. Permitidas: ${permitidos.join(', ') || 'nenhuma'}`,
    );
  }
}

/** Retorna true se a expedição está "aberta" (aceita mutações de carga). */
export function expedicaoAberta(status: StatusCaminhao): boolean {
  return status === 'em_carga' || status === 'em_conferencia';
}
