import { z } from 'zod';

export const definirPermissoesSchema = z.object({
  permissoes: z.array(z.string().min(1)).max(100),
});

export type DefinirPermissoesDto = z.infer<typeof definirPermissoesSchema>;
