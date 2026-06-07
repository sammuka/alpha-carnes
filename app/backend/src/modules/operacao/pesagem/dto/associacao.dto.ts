import { z } from 'zod';
import { divergenciaInputSchema } from '../../recebimento/divergencia/dto/divergencia-recebimento.dto';

export const confirmarAssociacaoSchema = z.object({
  pedidoVendaItemId: z.string().uuid(),
});
export type ConfirmarAssociacaoDto = z.infer<typeof confirmarAssociacaoSchema>;

export const redirecionarSchema = z.object({
  pedidoVendaItemId: z.string().uuid(),
  motivo: z.string().trim().min(1, 'motivo é obrigatório').max(500),
});
export type RedirecionarDto = z.infer<typeof redirecionarSchema>;

export const DESTINOS_SEM_COBERTURA = ['sobra', 'analise', 'corte', 'divergencia'] as const;

/**
 * Destinação de peça sem cobertura (RF-PS-11/21/22). `sobra` exige motivo;
 * `divergencia` exige a classificação formal (reusa o contrato de F4a).
 */
export const semCoberturaSchema = z
  .object({
    destino: z.enum(DESTINOS_SEM_COBERTURA),
    motivo: z.string().trim().max(500).optional(),
    divergencia: divergenciaInputSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.destino === 'sobra' && !v.motivo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'motivo é obrigatório para destinar à sobra (RF-PS-21)' });
    }
    if (v.destino === 'divergencia' && !v.divergencia) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['divergencia'], message: 'classificação de divergência é obrigatória (RF-PS-22)' });
    }
  });
export type SemCoberturaDto = z.infer<typeof semCoberturaSchema>;
