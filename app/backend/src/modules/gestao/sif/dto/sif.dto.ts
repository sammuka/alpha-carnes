import { z } from 'zod';

export const listarSifSchema = z.object({
  operacaoId: z.string().uuid(),
});
export type ListarSifDto = z.infer<typeof listarSifSchema>;

export const retificarSifSchema = z.object({
  motivo: z.string().trim().min(10).max(1000),
});
export type RetificarSifDto = z.infer<typeof retificarSifSchema>;
