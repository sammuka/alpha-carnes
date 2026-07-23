import { z } from 'zod';

export const createRepresentanteSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  nome: z.string().trim().min(1).max(200),
  tipoCanal: z.string().trim().max(100).optional(),
  contato: z.string().trim().max(200).optional(),
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
  observacao: z.string().trim().optional(),
});

export type CreateRepresentanteDto = z.infer<typeof createRepresentanteSchema>;

export const updateRepresentanteSchema = createRepresentanteSchema.partial();
export type UpdateRepresentanteDto = z.infer<typeof updateRepresentanteSchema>;
