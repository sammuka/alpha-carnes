import { z } from 'zod';
import { listaCnaesSchema } from './cnae.dto';
import {
  inscricaoSchema,
  justificativaSchema,
  nomeEstabelecimentoSchema,
  ufSchema,
  versaoSchema,
} from './comum.dto';

/** Proposta de alteração de estabelecimento APPROVED (D22): valores completos; `versao` do estabelecimento. */
export const createAlteracaoSchema = z
  .object({
    nome: nomeEstabelecimentoSchema,
    inscricaoEstadual: inscricaoSchema,
    inscricaoMunicipal: inscricaoSchema,
    uf: ufSchema,
    cnaes: listaCnaesSchema,
    versao: versaoSchema,
    justificativa: justificativaSchema,
  })
  .strict();
export type CreateAlteracaoDto = z.infer<typeof createAlteracaoSchema>;

/** Edição da proposta em DRAFT; `versao` da alteração. */
export const updateAlteracaoSchema = z
  .object({
    nome: nomeEstabelecimentoSchema.optional(),
    inscricaoEstadual: inscricaoSchema.optional(),
    inscricaoMunicipal: inscricaoSchema.optional(),
    uf: ufSchema.optional(),
    cnaes: listaCnaesSchema.optional(),
    versao: versaoSchema,
    justificativa: justificativaSchema,
  })
  .strict();
export type UpdateAlteracaoDto = z.infer<typeof updateAlteracaoSchema>;
