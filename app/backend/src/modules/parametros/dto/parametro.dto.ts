import { z } from 'zod';

export const createParametroSchema = z.object({
  chave: z.string().trim().min(1).max(100),
  valorJson: z.record(z.string(), z.unknown()).optional(),
  descricao: z.string().trim().optional(),
});

export type CreateParametroDto = z.infer<typeof createParametroSchema>;

export const updateParametroSchema = z.object({
  valorJson: z.record(z.string(), z.unknown()).optional(),
  descricao: z.string().trim().optional(),
});

export type UpdateParametroDto = z.infer<typeof updateParametroSchema>;

export const atualizarValorSchema = z.object({
  valorJson: z.record(z.string(), z.unknown()),
});

export type AtualizarValorDto = z.infer<typeof atualizarValorSchema>;
