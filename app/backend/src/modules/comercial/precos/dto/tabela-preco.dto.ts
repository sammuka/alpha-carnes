import { z } from 'zod';

export const criarTabelaPrecoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD'),
  observacao: z.string().trim().max(500).optional(),
});
export type CriarTabelaPrecoDto = z.infer<typeof criarTabelaPrecoSchema>;

const precoOpcional = z.coerce.number().positive().max(9_999_999_999.99).nullable().optional();

export const salvarItensTabelaPrecoSchema = z.object({
  itens: z.array(z.object({
    produtoId: z.string().uuid(),
    precoA: precoOpcional, precoB: precoOpcional,
    precoC: precoOpcional, precoD: precoOpcional,
  })).min(1),
});
export type SalvarItensTabelaPrecoDto = z.infer<typeof salvarItensTabelaPrecoSchema>;

export const copiarTabelaPrecoSchema = z.object({ origemId: z.string().uuid().optional() });
export type CopiarTabelaPrecoDto = z.infer<typeof copiarTabelaPrecoSchema>;

export const publicarTabelaPrecoSchema = z.object({
  observacao: z.string().trim().max(500).optional(),
});
export type PublicarTabelaPrecoDto = z.infer<typeof publicarTabelaPrecoSchema>;
