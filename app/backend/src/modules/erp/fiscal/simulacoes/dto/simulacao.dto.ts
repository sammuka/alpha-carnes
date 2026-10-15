import { z } from 'zod';
import {
  competenciaSchema,
  justificativaSchema,
  pesoSchema,
  quantidadeSchema,
  uuidSchema,
  valorSchema,
  dinheiroSchema,
  versaoSchema,
} from './comum.dto';

const camposSimulacao = {
  estabelecimentoId: uuidSchema,
  operacaoId: uuidSchema,
  clienteId: uuidSchema,
  produtoId: uuidSchema,
  ncmId: uuidSchema,
  quantidade: quantidadeSchema,
  pesoNf: pesoSchema,
  valor: valorSchema,
  desconto: dinheiroSchema,
  competencia: competenciaSchema,
  enquadramentoId: uuidSchema,
  justificativa: justificativaSchema,
};

export const criarSimulacaoSchema = z.object(camposSimulacao).strict();
export type CriarSimulacaoDto = z.infer<typeof criarSimulacaoSchema>;

export const novaVersaoSchema = z.object({
  ...camposSimulacao,
  versao: versaoSchema,
}).strict();
export type NovaVersaoDto = z.infer<typeof novaVersaoSchema>;

export const SORT_SIMULACOES = ['cliente', 'produto', 'valor', 'valorLiquido', 'estabelecimento', 'operacao'] as const;

export const listarSimulacoesSchema = z.object({
  estabelecimentoId: uuidSchema.optional(),
  clienteId: uuidSchema.optional(),
  produtoId: uuidSchema.optional(),
  competencia: competenciaSchema.optional(),
  search: z.string().trim().optional(),
  sort: z.enum(SORT_SIMULACOES).default('cliente'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarSimulacoesQuery = z.infer<typeof listarSimulacoesSchema>;
