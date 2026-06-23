import { z } from 'zod';

export const createRotaSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  nome: z.string().trim().min(1).max(200),
  regiao: z.string().trim().max(100).optional(),
  representantePadrao: z.string().trim().max(200).optional(),
  caminhaoPadrao: z.string().trim().max(100).optional(),
  motoristaPadrao: z.string().trim().max(200).optional(),
  observacoes: z.string().trim().optional(),
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
});

export type CreateRotaDto = z.infer<typeof createRotaSchema>;

export const updateRotaSchema = createRotaSchema.partial();
export type UpdateRotaDto = z.infer<typeof updateRotaSchema>;
