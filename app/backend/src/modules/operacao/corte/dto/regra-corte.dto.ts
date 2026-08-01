import { z } from 'zod';

export const vincularRegraSchema = z.object({
  regraTransformacaoId: z.string().uuid(),
});
export type VincularRegraDto = z.infer<typeof vincularRegraSchema>;
