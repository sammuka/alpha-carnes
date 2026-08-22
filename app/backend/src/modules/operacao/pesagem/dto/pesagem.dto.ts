import { z } from 'zod';

export const MODOS_CAPTURA = ['automatico', 'manual_assistido'] as const;
export const MOTIVOS_CAPTURA_MANUAL = [
  'dispositivo_indisponivel',
  'leitura_instavel',
  'divergencia_balanca',
  'outro',
] as const;

/**
 * Registro de pesagem de uma peça (ADR-009). No modo `automatico` o peso vem do
 * gateway de balança (não é informado no body). No `manual_assistido` o peso e o
 * `motivo` são obrigatórios — validado por superRefine para falhar explícito (400)
 * sem motivo, sem nunca inventar valor.
 */
export const registrarPesagemSchema = z
  .object({
    recebimentoId: z.string().uuid(),
    itemComercialBaseId: z.string().uuid(),
    classificacaoOperacional: z.string().trim().max(200).optional(),
    modoCaptura: z.enum(MODOS_CAPTURA),
    pesoManual: z.number().positive().max(9_999_999.999).optional(),
    motivo: z.enum(MOTIVOS_CAPTURA_MANUAL).optional(),
    motivoDetalhe: z.string().trim().max(500).optional(),
    observacoes: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modoCaptura === 'manual_assistido') {
      if (v.pesoManual === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pesoManual'], message: 'Informe o peso manual no modo manual assistido.' });
      }
      if (!v.motivo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'motivo é obrigatório no modo manual assistido' });
      }
      if (v.motivo === 'outro' && !v.motivoDetalhe) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivoDetalhe'], message: 'Detalhe o motivo ao selecionar "Outro".' });
      }
    }
  });

export type RegistrarPesagemDto = z.infer<typeof registrarPesagemSchema>;
