import { z } from 'zod';

/**
 * Leitura de QR no fluxo de etiqueta/conferência. No modo manual (leitor
 * indisponível) exige código digitado + motivo (ADR-009); o código DEVE resolver
 * numa peça real (validado no service). Modo automático lê do gateway.
 */
export const resolverQrSchema = z
  .object({
    modoCaptura: z.enum(['automatico', 'manual_assistido']),
    codigo: z.string().trim().max(200).optional(),
    motivo: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modoCaptura === 'manual_assistido') {
      if (!v.codigo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['codigo'], message: 'codigo é obrigatório na leitura manual' });
      }
      if (!v.motivo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'motivo é obrigatório na leitura manual' });
      }
    }
  });
export type ResolverQrDto = z.infer<typeof resolverQrSchema>;
