import { z } from 'zod';
import { normalizarCnpj } from '../../../../../common/validators/cnpj-alfanumerico';
import {
  CNPJ_ENTRADA_ASCII,
  justificativaSchema,
  MENSAGEM_CNPJ_ASCII,
  MENSAGEM_NULO,
  semNulo,
  versaoSchema,
} from './comum.dto';

/** CNPJ raiz alfanumérico (D3): normalizado, `^[0-9A-Z]{8}$`. */
export const cnpjRaizSchema = z
  .string()
  .regex(CNPJ_ENTRADA_ASCII, MENSAGEM_CNPJ_ASCII)
  .transform(normalizarCnpj)
  .pipe(z.string().regex(/^[0-9A-Z]{8}$/, 'CNPJ raiz deve ter 8 letras ou dígitos.'));

const razaoSocialSchema = z.string().trim().min(1).max(150).refine(semNulo, MENSAGEM_NULO);

export const listarEmpresasQuerySchema = z.object({
  search: z.string().trim().refine(semNulo, MENSAGEM_NULO).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarEmpresasQuery = z.infer<typeof listarEmpresasQuerySchema>;

export const createEmpresaSchema = z.object({
  razaoSocial: razaoSocialSchema,
  cnpjRaiz: cnpjRaizSchema,
  justificativa: justificativaSchema,
});
export type CreateEmpresaDto = z.infer<typeof createEmpresaSchema>;

/** `cnpjRaiz` é imutável: `.strict()` rejeita (D2). */
export const updateEmpresaSchema = z
  .object({
    razaoSocial: razaoSocialSchema,
    versao: versaoSchema,
    justificativa: justificativaSchema,
  })
  .strict();
export type UpdateEmpresaDto = z.infer<typeof updateEmpresaSchema>;
