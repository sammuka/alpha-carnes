import { z } from 'zod';

export const saidaRegraSchema = z.object({
  produtoId: z.string().uuid(),
  quantidadeFixa: z.number().positive(),
});

export const createRegraTransformacaoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  produtoOrigemCodigo: z.string().trim().min(1).max(50).optional().default('TZ'),
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
  prioridade: z.number().int().optional().default(0),
  observacao: z.string().trim().optional(),
  saidas: z.array(saidaRegraSchema).min(1),
});

export type CreateRegraTransformacaoDto = z.infer<typeof createRegraTransformacaoSchema>;

export const updateRegraTransformacaoSchema = createRegraTransformacaoSchema.partial();
export type UpdateRegraTransformacaoDto = z.infer<typeof updateRegraTransformacaoSchema>;
