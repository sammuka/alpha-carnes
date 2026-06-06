import { z } from 'zod';

export const createUsuarioSchema = z.object({
  nome: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(8),
  perfis: z.array(z.string()).optional().default([]),
});

export type CreateUsuarioDto = z.infer<typeof createUsuarioSchema>;
