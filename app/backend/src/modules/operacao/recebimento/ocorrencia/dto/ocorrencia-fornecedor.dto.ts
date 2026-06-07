import { z } from 'zod';

export const abrirOcorrenciaSchema = z.object({
  fornecedorId: z.string().uuid(),
  compraProgramadaId: z.string().uuid().optional(),
  divergenciaId: z.string().uuid().optional(),
  descricao: z.string().trim().min(1, 'descricao é obrigatória').max(2000),
  impacto: z.string().trim().max(2000).optional(),
  retornoFornecedor: z.string().trim().max(2000).optional(),
  proximoPasso: z.string().trim().max(2000).optional(),
});

export type AbrirOcorrenciaDto = z.infer<typeof abrirOcorrenciaSchema>;

export const STATUS_OCORRENCIA = ['aberta', 'em_analise', 'aguardando_fornecedor', 'resolvida'] as const;

/** Atualização da tratativa (gera entrada na timeline). */
export const atualizarOcorrenciaSchema = z
  .object({
    status: z.enum(STATUS_OCORRENCIA).optional(),
    acao: z.string().trim().min(1).max(2000),
    retornoFornecedor: z.string().trim().max(2000).optional(),
    proximoPasso: z.string().trim().max(2000).optional(),
    situacao: z.string().trim().max(2000).optional(),
    impacto: z.string().trim().max(2000).optional(),
  });

export type AtualizarOcorrenciaDto = z.infer<typeof atualizarOcorrenciaSchema>;

/** Encerramento: desfecho obrigatório. */
export const encerrarOcorrenciaSchema = z.object({
  desfecho: z.string().trim().min(1, 'desfecho é obrigatório ao encerrar').max(2000),
  retornoFornecedor: z.string().trim().max(2000).optional(),
});

export type EncerrarOcorrenciaDto = z.infer<typeof encerrarOcorrenciaSchema>;
