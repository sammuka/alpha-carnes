import { z } from 'zod';

export const createRegraDesdobramentoSchema = z
  .object({
    itemCompraId: z.string().uuid('itemCompraId inválido'),
    itemComercialId: z.string().uuid('itemComercialId inválido'),
    // fatorQuantidade > 0 (invariante de negócio). Aceita number ou string numérica (NUMERIC).
    fatorQuantidade: z.coerce.number().positive('fatorQuantidade deve ser maior que zero'),
    status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
    vigenciaInicio: z.coerce.date(),
    vigenciaFim: z.coerce.date().optional().nullable(),
    observacoes: z.string().trim().optional(),
  })
  .refine((v) => !v.vigenciaFim || v.vigenciaFim > v.vigenciaInicio, {
    message: 'vigenciaFim deve ser posterior a vigenciaInicio',
    path: ['vigenciaFim'],
  });

export type CreateRegraDesdobramentoDto = z.infer<typeof createRegraDesdobramentoSchema>;

// Update parcial; mantém a mesma validação de vigência quando ambos os campos vierem.
export const updateRegraDesdobramentoSchema = z
  .object({
    itemCompraId: z.string().uuid().optional(),
    itemComercialId: z.string().uuid().optional(),
    fatorQuantidade: z.coerce.number().positive('fatorQuantidade deve ser maior que zero').optional(),
    status: z.enum(['ativo', 'inativo']).optional(),
    vigenciaInicio: z.coerce.date().optional(),
    vigenciaFim: z.coerce.date().optional().nullable(),
    observacoes: z.string().trim().optional(),
  })
  .refine((v) => !(v.vigenciaInicio && v.vigenciaFim) || v.vigenciaFim > v.vigenciaInicio, {
    message: 'vigenciaFim deve ser posterior a vigenciaInicio',
    path: ['vigenciaFim'],
  });

export type UpdateRegraDesdobramentoDto = z.infer<typeof updateRegraDesdobramentoSchema>;
