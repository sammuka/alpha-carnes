import { z } from 'zod';

export const createCaminhaoCadastroSchema = z.object({
  placa: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/, 'Placa inválida. Use o formato ABC-1D23'),
  descricao: z.string().trim().max(200).optional(),
  capacidadeKg: z.coerce.number().int().min(0).default(0),
  rotaPadraoId: z.string().uuid().nullable().optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});

export type CreateCaminhaoCadastroDto = z.infer<typeof createCaminhaoCadastroSchema>;

export const updateCaminhaoCadastroSchema = createCaminhaoCadastroSchema.partial();
export type UpdateCaminhaoCadastroDto = z.infer<typeof updateCaminhaoCadastroSchema>;
