import { z } from 'zod';
import { normalizarCnae, validarFormatoCnae } from '../../../../../common/validators/cnae';
import { MENSAGEM_NULO, semNulo } from './comum.dto';
import { TIPOS_CNAE } from '../../../../../database/schema/fiscal-empresas.schema';

/** CNAE subclasse 2.x (D21): entrada `0000-0/00` ou `0000000`, armazenado só dígitos. */
export const codigoCnaeSchema = z
  .string()
  .transform(normalizarCnae)
  .refine(validarFormatoCnae, { message: 'CNAE deve ter 7 dígitos (0000-0/00).' });

export const cnaeItemSchema = z.object({
  codigo: codigoCnaeSchema,
  descricao: z.string().trim().min(1).max(255).refine(semNulo, MENSAGEM_NULO),
  tipo: z.enum(TIPOS_CNAE),
});
export type CnaeItemDto = z.infer<typeof cnaeItemSchema>;

/** Lista de CNAEs (0..50). Principal único e duplicidade são regra de serviço (422). */
export const listaCnaesSchema = z.array(cnaeItemSchema).max(50);
