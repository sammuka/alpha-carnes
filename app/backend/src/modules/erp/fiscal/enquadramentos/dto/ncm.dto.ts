import { z } from 'zod';
import { normalizarNcm, validarNcm } from '../../../../../common/validators/ncm';
import { justificativaSchema } from './comum.dto';
import { listarCodigoFiscalQuerySchema } from './cfop.dto';

export const codigoNcmSchema = z
  .string()
  .transform(normalizarNcm)
  .refine(validarNcm, { message: 'NCM deve ter 8 dígitos.' });

export const createNcmSchema = z.object({
  codigo: codigoNcmSchema,
  descricao: z.string().trim().min(1).max(255),
  justificativa: justificativaSchema,
}).strict();
export type CreateNcmDto = z.infer<typeof createNcmSchema>;

export { listarCodigoFiscalQuerySchema };
export type ListarNcmQuery = z.infer<typeof listarCodigoFiscalQuerySchema>;
