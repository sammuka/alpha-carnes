import { z } from 'zod';
import { normalizarCest, validarCest } from '../../../../../common/validators/cest';
import {
  ABRANGENCIAS_FISCAIS,
  FIN_NFE,
  TIPOS_PRODUTO_FISCAL,
  TP_NF,
} from '../../../../../database/schema/fiscal-enquadramentos.schema';
import { buscaSchema, dataSchema, justificativaSchema, uuidSchema, versaoSchema } from './comum.dto';

export const cestSchema = z
  .string()
  .transform(normalizarCest)
  .refine(validarCest, { message: 'CEST deve ter 7 dígitos.' });

/** Limite do `integer` do Postgres: acima disso o insert falharia com 500. */
const PRIORIDADE_MAXIMA = 2147483647;

const MENSAGEM_VIGENCIA = 'Fim de vigência deve ser igual ou posterior ao início.';

function vigenciaOrdenada(
  valor: { vigenciaInicio?: string; vigenciaFim?: string },
  ctx: z.RefinementCtx,
): void {
  if (valor.vigenciaInicio && valor.vigenciaFim && valor.vigenciaFim < valor.vigenciaInicio) {
    ctx.addIssue({ code: 'custom', message: MENSAGEM_VIGENCIA, path: ['vigenciaFim'] });
  }
}

const camposChave = {
  operacaoId: uuidSchema,
  tpNf: z.enum(TP_NF),
  finNfe: z.enum(FIN_NFE),
  cfopId: uuidSchema,
  abrangencia: z.enum(ABRANGENCIAS_FISCAIS),
  tipoProduto: z.enum(TIPOS_PRODUTO_FISCAL),
  produtoId: uuidSchema,
  ncmId: uuidSchema,
  cest: cestSchema,
  clienteId: uuidSchema,
};

export const createEnquadramentoSchema = z.object({
  estabelecimentoId: uuidSchema,
  ...camposChave,
  vigenciaInicio: dataSchema,
  vigenciaFim: dataSchema.optional(),
  prioridade: z.number().int().min(1).max(PRIORIDADE_MAXIMA),
  justificativa: justificativaSchema,
}).strict().superRefine(vigenciaOrdenada);
export type CreateEnquadramentoDto = z.infer<typeof createEnquadramentoSchema>;

/** Rejeita `codigo`, `empresaId` e `estabelecimentoId` (D15, D3). */
export const updateEnquadramentoSchema = z.object({
  ...camposChave,
  vigenciaInicio: dataSchema,
  vigenciaFim: dataSchema.optional(),
  prioridade: z.number().int().min(1).max(PRIORIDADE_MAXIMA),
  versao: versaoSchema,
  justificativa: justificativaSchema,
}).strict().superRefine(vigenciaOrdenada);
export type UpdateEnquadramentoDto = z.infer<typeof updateEnquadramentoSchema>;

export const duplicarEnquadramentoSchema = z.object({
  vigenciaInicio: dataSchema,
  vigenciaFim: dataSchema.optional(),
  prioridade: z.number().int().min(1).max(PRIORIDADE_MAXIMA).optional(),
  versao: versaoSchema,
  justificativa: justificativaSchema,
}).strict().superRefine(vigenciaOrdenada);
export type DuplicarEnquadramentoDto = z.infer<typeof duplicarEnquadramentoSchema>;

export const acaoSituacaoSchema = z.object({
  versao: versaoSchema,
  justificativa: justificativaSchema,
}).strict();
export type AcaoSituacaoDto = z.infer<typeof acaoSituacaoSchema>;

export const removerEnquadramentoSchema = z.object({
  justificativa: justificativaSchema,
}).strict();
export type RemoverEnquadramentoDto = z.infer<typeof removerEnquadramentoSchema>;

export const SORT_ENQUADRAMENTO = [
  'operacao', 'cfop', 'vigenciaInicio', 'estabelecimento', 'tpNF', 'finNFe',
] as const;

export const listarEnquadramentosQuerySchema = z.object({
  estabelecimentoId: uuidSchema.optional(),
  cfopId: uuidSchema.optional(),
  produtoId: uuidSchema.optional(),
  clienteId: uuidSchema.optional(),
  search: buscaSchema,
  sort: z.enum(SORT_ENQUADRAMENTO).default('operacao'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarEnquadramentosQuery = z.infer<typeof listarEnquadramentosQuerySchema>;

export const idParamSchema = uuidSchema;
