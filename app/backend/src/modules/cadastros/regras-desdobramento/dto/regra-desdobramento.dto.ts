import { z } from 'zod';

export const createRegraDesdobramentoSchema = z
  .object({
    produtoOrigemId: z.string().uuid('Selecione um produto de origem válido.'),
    produtoDestinoId: z.string().uuid('Selecione um produto de destino válido.'),
    fatorQuantidade: z.coerce.number().positive('O fator de quantidade deve ser maior que zero.'),
    status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
    vigenciaInicio: z.coerce.date(),
    vigenciaFim: z.coerce.date().optional().nullable(),
    observacoes: z.string().trim().optional(),
  })
  .strict()
  .refine((v) => !v.vigenciaFim || v.vigenciaFim > v.vigenciaInicio, {
    message: 'O fim da vigência deve ser posterior ao início.',
    path: ['vigenciaFim'],
  })
  .refine((v) => v.produtoOrigemId !== v.produtoDestinoId, {
    message: 'Origem e destino devem ser produtos distintos.',
    path: ['produtoDestinoId'],
  });

export type CreateRegraDesdobramentoDto = z.infer<typeof createRegraDesdobramentoSchema>;

export const updateRegraDesdobramentoSchema = z
  .object({
    produtoOrigemId: z.string().uuid().optional(),
    produtoDestinoId: z.string().uuid().optional(),
    fatorQuantidade: z.coerce.number().positive('O fator de quantidade deve ser maior que zero.').optional(),
    status: z.enum(['ativo', 'inativo']).optional(),
    vigenciaInicio: z.coerce.date().optional(),
    vigenciaFim: z.coerce.date().optional().nullable(),
    observacoes: z.string().trim().optional(),
  })
  .strict()
  .refine((v) => !(v.vigenciaInicio && v.vigenciaFim) || v.vigenciaFim > v.vigenciaInicio, {
    message: 'O fim da vigência deve ser posterior ao início.',
    path: ['vigenciaFim'],
  });

export type UpdateRegraDesdobramentoDto = z.infer<typeof updateRegraDesdobramentoSchema>;
