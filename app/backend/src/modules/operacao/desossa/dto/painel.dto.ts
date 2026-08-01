import { z } from 'zod';

export const painelQuerySchema = z.object({
  modoTv: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  operacaoId: z.string().uuid().optional(),
});
export type PainelQuery = z.infer<typeof painelQuerySchema>;
