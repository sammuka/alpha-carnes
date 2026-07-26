import { z } from 'zod';

export const registrarAdendoSchema = z.object({
  itemComercialId: z.string().uuid(),
  quantidadeAdicionada: z.coerce.number().positive().max(9_999_999_999.999),
  motivo: z.string().trim().min(3, 'motivo do adendo é obrigatório').max(1000),
});
export type RegistrarAdendoDto = z.infer<typeof registrarAdendoSchema>;

export const confirmarAdendoOverbookingSchema = registrarAdendoSchema;
