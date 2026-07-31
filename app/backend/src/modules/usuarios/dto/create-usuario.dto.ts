import { z } from 'zod';
import { representantesPermitidosSchema } from './update-usuario.dto';

export const createUsuarioSchema = z.object({
  nome: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(8),
  perfis: z.array(z.string()).optional().default([]),
  representantes: representantesPermitidosSchema.optional().default([]),
});

export type CreateUsuarioDto = z.infer<typeof createUsuarioSchema>;
