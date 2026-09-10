import { z } from 'zod';

export const vigenteQuerySchema = z.object({
  produtoIds: z.string().min(1).transform((s, ctx) => {
    const ids = s.split(',').map((x) => x.trim()).filter(Boolean);
    if (ids.length === 0 || ids.some((id) => !z.string().uuid().safeParse(id).success)) {
      ctx.addIssue({ code: 'custom', message: 'produtoIds deve ser lista de UUIDs separados por vírgula.' });
      return z.NEVER;
    }
    return ids;
  }),
  clienteId: z.string().uuid(),
  operacaoId: z.string().uuid(),
});
export type VigenteQuery = z.infer<typeof vigenteQuerySchema>;

export type PrecoVigenteHttp = {
  produtoId: string;
  preco: string | null;
  unidadePreco: 'kg' | 'unidade' | null;
  tabelaPrecoId: string | null;
};
export type PrecoVigenteEnvelope = { data: PrecoVigenteHttp[] };
