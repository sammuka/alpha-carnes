import { z } from 'zod';
import { normalizarCnpj, validarCnpjAlfanumerico } from '../../../../../common/validators/cnpj-alfanumerico';
import { SITUACOES_ESTABELECIMENTO } from '../../../../../database/schema/fiscal-empresas.schema';
import { listaCnaesSchema } from './cnae.dto';
import {
  inscricaoSchema,
  justificativaSchema,
  nomeEstabelecimentoSchema,
  ufSchema,
  versaoSchema,
} from './comum.dto';

/** CNPJ alfanumérico com DV (D3). */
export const cnpjSchema = z
  .string()
  .transform(normalizarCnpj)
  .refine(validarCnpjAlfanumerico, { message: 'CNPJ inválido: confira os dígitos verificadores.' });

export const ORDENACOES_ESTABELECIMENTO = ['estabelecimento', 'cnpj', 'regime', 'uf', 'empresa'] as const;

export const listarEstabelecimentosQuerySchema = z.object({
  empresaId: z.string().uuid().optional(),
  estabelecimentoId: z.string().uuid().optional(),
  situacao: z.enum(SITUACOES_ESTABELECIMENTO).optional(),
  search: z.string().trim().optional(),
  sort: z.enum(ORDENACOES_ESTABELECIMENTO).default('estabelecimento'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarEstabelecimentosQuery = z.infer<typeof listarEstabelecimentosQuerySchema>;

/** `municipioIbgeCodigo` não é gravável nesta fatia (AD-24 (2)): `.strict()` rejeita. */
export const createEstabelecimentoSchema = z
  .object({
    empresaId: z.string().uuid(),
    nome: nomeEstabelecimentoSchema,
    cnpj: cnpjSchema,
    inscricaoEstadual: inscricaoSchema,
    inscricaoMunicipal: inscricaoSchema,
    uf: ufSchema,
    cnaes: listaCnaesSchema.optional(),
    justificativa: justificativaSchema,
  })
  .strict();
export type CreateEstabelecimentoDto = z.infer<typeof createEstabelecimentoSchema>;

/** `empresaId`, `cnpj` e `municipioIbgeCodigo` imutáveis/não graváveis: `.strict()` rejeita (D2). */
export const updateEstabelecimentoSchema = z
  .object({
    nome: nomeEstabelecimentoSchema.optional(),
    inscricaoEstadual: inscricaoSchema.optional(),
    inscricaoMunicipal: inscricaoSchema.optional(),
    uf: ufSchema.optional(),
    versao: versaoSchema,
    justificativa: justificativaSchema,
  })
  .strict();
export type UpdateEstabelecimentoDto = z.infer<typeof updateEstabelecimentoSchema>;

export const substituirCnaesSchema = z
  .object({
    cnaes: listaCnaesSchema,
    versao: versaoSchema,
    justificativa: justificativaSchema,
  })
  .strict();
export type SubstituirCnaesDto = z.infer<typeof substituirCnaesSchema>;
