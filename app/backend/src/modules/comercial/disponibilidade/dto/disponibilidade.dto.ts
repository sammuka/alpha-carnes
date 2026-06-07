import { z } from 'zod';

export const listarDisponibilidadeSchema = z.object({
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataOperacao deve ser YYYY-MM-DD').optional(),
  compraProgramadaId: z.string().uuid().optional(),
});

export type ListarDisponibilidadeQuery = z.infer<typeof listarDisponibilidadeSchema>;
