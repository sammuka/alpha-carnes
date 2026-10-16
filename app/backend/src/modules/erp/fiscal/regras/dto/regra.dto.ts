import { z } from 'zod';
import {
  IBS_CST,
  ICMS_CST,
  IPI_CST,
  PIS_CST,
  SITUACOES_REGRA,
} from '../../../../../database/schema/fiscal-regras.schema';
import { buscaSchema, dataVigenciaSchema, justificativaSchema, percentualSchema, uuidSchema, versaoSchema } from './comum.dto';

const MENSAGEM_VIGENCIA = 'Fim de vigência deve ser igual ou posterior ao início.';

function vigenciaOrdenada(
  valor: { vigenciaInicio?: string; vigenciaFim?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (valor.vigenciaInicio && valor.vigenciaFim && valor.vigenciaFim < valor.vigenciaInicio) {
    ctx.addIssue({ code: 'custom', message: MENSAGEM_VIGENCIA, path: ['vigenciaFim'] });
  }
}

const camposRegra = {
  enquadramentoId: uuidSchema,
  operacaoId: uuidSchema,
  cfopId: uuidSchema,
  icmsCst: z.enum(ICMS_CST),
  pRedBc: percentualSchema,
  pIcms: percentualSchema,
  beneficioFiscalId: uuidSchema,
  ipiCst: z.enum(IPI_CST),
  pisCst: z.enum(PIS_CST),
  ibsCst: z.enum(IBS_CST),
  classificacaoIbsCbsId: uuidSchema,
  vigenciaInicio: dataVigenciaSchema,
  vigenciaFim: dataVigenciaSchema.nullish(),
  justificativa: justificativaSchema,
};

export const criarRegraSchema = z.object(camposRegra).strict().superRefine(vigenciaOrdenada);
export type CriarRegraDto = z.infer<typeof criarRegraSchema>;

export const atualizarRegraSchema = z.object({
  ...camposRegra,
  versao: versaoSchema,
}).strict().superRefine(vigenciaOrdenada);
export type AtualizarRegraDto = z.infer<typeof atualizarRegraSchema>;

export const acaoRegraSchema = z.object({
  versao: versaoSchema,
  justificativa: justificativaSchema,
}).strict();
export type AcaoRegraDto = z.infer<typeof acaoRegraSchema>;

export const novaVersaoSchema = z.object({
  ...camposRegra,
  versao: versaoSchema,
}).strict().superRefine(vigenciaOrdenada);
export type NovaVersaoDto = z.infer<typeof novaVersaoSchema>;

export const SORT_REGRAS = ['enquadramento', 'cfop', 'cBenef', 'cClassTrib', 'operacao', 'icmsCst'] as const;

export const listarRegrasSchema = z.object({
  cfopId: uuidSchema.optional(),
  search: buscaSchema,
  /** Código da linhagem: lista as versões de uma mesma regra. */
  codigo: buscaSchema,
  situacao: z.enum(SITUACOES_REGRA).optional(),
  sort: z.enum(SORT_REGRAS).default('enquadramento'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarRegrasQuery = z.infer<typeof listarRegrasSchema>;
