import { z } from 'zod';

export const representantesPermitidosSchema = z
  .array(z.string().uuid())
  .superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Representantes permitidos não podem conter duplicidades',
      });
    }
  });

export const definirRepresentantesSchema = z.object({
  representantes: representantesPermitidosSchema,
});

export type DefinirRepresentantesDto = z.infer<typeof definirRepresentantesSchema>;

export const updateUsuarioSchema = z.object({
  nome: z.string().min(2).max(200).optional(),
  email: z.string().email().optional(),
  ativo: z.boolean().optional(),
});

export type UpdateUsuarioDto = z.infer<typeof updateUsuarioSchema>;

export const definirPerfisSchema = z.object({
  perfis: z.array(z.string().min(1)).max(20),
});

export type DefinirPerfisDto = z.infer<typeof definirPerfisSchema>;
