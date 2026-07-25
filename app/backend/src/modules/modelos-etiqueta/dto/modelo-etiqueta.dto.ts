import { z } from 'zod';
import { CAMPOS_ETIQUETA } from '../../../database/schema/modelos-etiqueta.schema';

/** Objeto com exatamente as 12 chaves booleanas — nem a mais, nem a menos (DoD-20). */
export const camposEtiquetaSchema = z
  .object(
    Object.fromEntries(CAMPOS_ETIQUETA.map((c) => [c, z.boolean()])) as Record<
      (typeof CAMPOS_ETIQUETA)[number],
      z.ZodBoolean
    >,
  )
  .strict();

export const createModeloEtiquetaSchema = z.object({
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Use apenas minúsculas, números e hífen'),
  nome: z.string().trim().min(1).max(120),
  campos: camposEtiquetaSchema,
  status: z.enum(['ativo', 'inativo']).default('ativo'),
});

export type CreateModeloEtiquetaDto = z.infer<typeof createModeloEtiquetaSchema>;

export const updateModeloEtiquetaSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  campos: camposEtiquetaSchema.optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
});

export type UpdateModeloEtiquetaDto = z.infer<typeof updateModeloEtiquetaSchema>;
