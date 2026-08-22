import { z } from 'zod';

export const listarDisponibilidadeSchema = z.object({
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da operação inválida — use o formato AAAA-MM-DD.').optional(),
  compraProgramadaId: z.string().uuid().optional(),
});

export type ListarDisponibilidadeQuery = z.infer<typeof listarDisponibilidadeSchema>;
