import { z } from 'zod';

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida — use o formato AAAA-MM-DD.');

export const createMotoristaSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  documento: z.string().trim().min(1).max(100),
  telefone: z.string().trim().max(50).optional(),
  caminhaoPadraoId: z.string().uuid().nullable().optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});

export type CreateMotoristaDto = z.infer<typeof createMotoristaSchema>;

export const updateMotoristaSchema = createMotoristaSchema.partial();
export type UpdateMotoristaDto = z.infer<typeof updateMotoristaSchema>;
