import { z } from 'zod';
import { listarQuerySchema } from '../../../../common/crud/paginacao';

// Quantidade comercial: numérico positivo com até 3 casas. Mantida como número
// na borda; convertida para string NUMERIC no service.
const quantidadeSchema = z
  .number()
  .positive('quantidade deve ser maior que zero')
  .max(9_999_999_999.999, 'quantidade fora do intervalo');

const itemCompraSchema = z.object({
  produtoId: z.string().uuid(),
  quantidadeComprada: quantidadeSchema,
  observacoes: z.string().trim().max(500).optional(),
});

export const createCompraProgramadaSchema = z.object({
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da operação inválida — use o formato AAAA-MM-DD.'),
  fornecedorId: z.string().uuid(),
  numeroInterno: z.string().trim().max(100).optional(),
  referenciaExterna: z.string().trim().max(100).optional(),
  previsaoEntrega: z.string().datetime({ offset: true }).optional(),
  observacoes: z.string().trim().max(1000).optional(),
  itens: z.array(itemCompraSchema).min(1, 'compra precisa de ao menos um item'),
}).strict();

export type CreateCompraProgramadaDto = z.infer<typeof createCompraProgramadaSchema>;

export const listarComprasProgramadasSchema = listarQuerySchema.extend({
  operacaoId: z.string().uuid().optional(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['rascunho', 'em_negociacao', 'confirmada', 'cancelada']).optional(),
  fornecedorId: z.string().uuid().optional(),
});
export type ListarComprasProgramadasDto = z.infer<typeof listarComprasProgramadasSchema>;

// Atualização do cabeçalho da compra (apenas enquanto não confirmada).
export const updateCompraProgramadaSchema = z.object({
  fornecedorId: z.string().uuid().optional(),
  numeroInterno: z.string().trim().max(100).optional(),
  referenciaExterna: z.string().trim().max(100).optional(),
  previsaoEntrega: z.string().datetime({ offset: true }).optional(),
  observacoes: z.string().trim().max(1000).optional(),
  status: z.enum(['rascunho', 'em_negociacao']).optional(),
});

export type UpdateCompraProgramadaDto = z.infer<typeof updateCompraProgramadaSchema>;

/** `simulacao=<produtoId>:<qtd>,<produtoId>:<qtd>` — read-only, pré-salvamento. */
export const impactoQuerySchema = z.object({
  simulacao: z.string().trim().optional().transform((valor, ctx) => {
    const mapa = new Map<string, string>();
    if (!valor) return mapa;
    for (const par of valor.split(',')) {
      const [id, qtd] = par.split(':');
      const idOk = z.string().uuid().safeParse(id ?? '');
      const qtdOk = /^\d+(\.\d{1,3})?$/.test(qtd ?? '');
      if (!idOk.success || !qtdOk) {
        ctx.addIssue({
          code: 'custom',
          message: `Simulação inválida em "${par}": use <produtoId>:<quantidade>`,
        });
        return z.NEVER;
      }
      mapa.set(idOk.data, qtd as string);
    }
    return mapa;
  }),
});

export const atualizarItemCompraSchema = z.object({
  quantidadeComprada: z
    .union([
      z.string().trim().regex(/^\d+(\.\d{1,3})?$/, 'Quantidade deve ter até 3 casas decimais.'),
      quantidadeSchema,
    ])
    .transform((valor) => (typeof valor === 'number' ? valor.toFixed(3) : valor))
    .refine((valor) => Number(valor) > 0, 'quantidade deve ser maior que zero'),
  observacoes: z.string().trim().max(500).optional(),
  confirmarDeficit: z.boolean().default(false),
}).strict();

export type ImpactoQueryDto = z.infer<typeof impactoQuerySchema>;
export type AtualizarItemCompraDto = z.infer<typeof atualizarItemCompraSchema>;
