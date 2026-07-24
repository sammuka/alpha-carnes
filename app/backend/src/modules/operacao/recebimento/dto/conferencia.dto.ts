import { z } from 'zod';

export const concluirConferenciaSchema = z.object({
  resultado: z.enum(['sem_divergencia', 'com_divergencia']),
  observacao: z.string().trim().max(2000).optional(),
});

export type ConcluirConferenciaDto = z.infer<typeof concluirConferenciaSchema>;
