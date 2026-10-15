import { z } from 'zod';
import { SITUACOES_HOMOLOGACAO } from '../../../../../database/schema/fiscal-homologacoes.schema';
import { justificativaSchema, uuidSchema, versaoSchema } from '../../enquadramentos/dto/comum.dto';

export const descricaoSchema = z.string().trim().min(3).max(500);

const camposDecisao = {
  versao: versaoSchema,
  justificativa: justificativaSchema,
};

export const criarHomologacaoSchema = z.object({
  regraId: uuidSchema,
  descricao: descricaoSchema,
  justificativa: justificativaSchema,
}).strict();

export const corpoDecisaoSchema = z.object(camposDecisao).strict();

export const vincularCenarioSchema = z.object({
  ...camposDecisao,
  simulacaoId: uuidSchema,
}).strict();

const SORT_HOMOLOGACOES = ['enquadramento', 'vigenciaInicio', 'usuario', 'aprovador', 'descricao'] as const;

export const listarHomologacoesSchema = z.object({
  search: z.string().trim().optional(),
  situacao: z.enum(SITUACOES_HOMOLOGACAO).optional(),
  sort: z.enum(SORT_HOMOLOGACOES).default('enquadramento'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type CriarHomologacaoDto = z.infer<typeof criarHomologacaoSchema>;
export type CorpoDecisaoDto = z.infer<typeof corpoDecisaoSchema>;
export type VincularCenarioDto = z.infer<typeof vincularCenarioSchema>;
export type ListarHomologacoesQuery = z.infer<typeof listarHomologacoesSchema>;
