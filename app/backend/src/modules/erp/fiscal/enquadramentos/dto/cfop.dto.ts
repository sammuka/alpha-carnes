import { z } from 'zod';
import { normalizarCfop, validarCfop } from '../../../../../common/validators/cfop';
import { buscaSchema, descricaoSchema, justificativaSchema } from './comum.dto';

export const codigoCfopSchema = z
  .string()
  .transform(normalizarCfop)
  .refine(validarCfop, { message: 'CFOP deve ter 4 dígitos.' });

export const createCfopSchema = z.object({
  codigo: codigoCfopSchema,
  descricao: descricaoSchema,
  justificativa: justificativaSchema,
}).strict();
export type CreateCfopDto = z.infer<typeof createCfopSchema>;

export const listarCodigoFiscalQuerySchema = z.object({
  search: buscaSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarCodigoFiscalQuery = z.infer<typeof listarCodigoFiscalQuerySchema>;
