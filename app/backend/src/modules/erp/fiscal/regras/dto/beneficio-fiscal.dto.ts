import { z } from 'zod';
import { justificativaSchema, listarCatalogoQuerySchema } from './comum.dto';

export const beneficioFiscalSchema = z.object({
  codigo: z.string().trim().regex(/^[A-Z]{2}[0-9]{6}$/),
  descricao: z.string().trim().min(1).max(255),
  justificativa: justificativaSchema,
}).strict();
export type BeneficioFiscalDto = z.infer<typeof beneficioFiscalSchema>;

export { listarCatalogoQuerySchema };
export type ListarBeneficiosQuery = z.infer<typeof listarCatalogoQuerySchema>;
