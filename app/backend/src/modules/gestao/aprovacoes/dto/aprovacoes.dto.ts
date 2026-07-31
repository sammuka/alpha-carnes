import { z } from 'zod';

export const listarAprovacoesSchema = z.object({
  operacaoId: z.string().uuid(),
  aba: z.enum(['ocorrencias', 'operacionais']).default('ocorrencias'),
  status: z.string().trim().optional(),
  busca: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const abrirAprovacaoSchema = z.object({
  operacaoId: z.string().uuid(),
  tipo: z.enum([
    'divergencia_transformacao', 'estorno_fora_regra',
    'reabertura_carga_pedido', 'ajuste_estoque_relevante',
  ]),
  origem: z.string().trim().min(3).max(120),
  descricao: z.string().trim().min(10).max(1000),
  impacto: z.string().trim().min(5).max(1000),
  referenciaTabela: z.string().trim().max(63).optional(),
  referenciaId: z.string().uuid().optional(),
});

export const decidirAprovacaoSchema = z.object({
  decisao: z.enum(['aprovada', 'rejeitada']),
  motivo: z.string().trim().min(10).max(1000),
});

export type ListarAprovacoesDto = z.infer<typeof listarAprovacoesSchema>;
export type AbrirAprovacaoDto = z.infer<typeof abrirAprovacaoSchema>;
export type DecidirAprovacaoDto = z.infer<typeof decidirAprovacaoSchema>;
