import { z } from 'zod';

// Quantidade comercial: numérico positivo com até 3 casas. Mantida como número
// na borda; convertida para string NUMERIC no service.
const quantidadeSchema = z
  .number()
  .positive('quantidade deve ser maior que zero')
  .max(9_999_999_999.999, 'quantidade fora do intervalo');

const itemCompraSchema = z.object({
  itemCompraId: z.string().uuid(),
  quantidadeComprada: quantidadeSchema,
  observacoes: z.string().trim().max(500).optional(),
});

export const createCompraProgramadaSchema = z.object({
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataOperacao deve ser YYYY-MM-DD'),
  fornecedorId: z.string().uuid(),
  numeroInterno: z.string().trim().max(100).optional(),
  referenciaExterna: z.string().trim().max(100).optional(),
  previsaoEntrega: z.string().datetime({ offset: true }).optional(),
  observacoes: z.string().trim().max(1000).optional(),
  itens: z.array(itemCompraSchema).min(1, 'compra precisa de ao menos um item'),
});

export type CreateCompraProgramadaDto = z.infer<typeof createCompraProgramadaSchema>;

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

// Atualização de um item da compra (apenas enquanto não confirmada).
export const updateCompraItemSchema = z.object({
  quantidadeComprada: quantidadeSchema.optional(),
  observacoes: z.string().trim().max(500).optional(),
});

export type UpdateCompraItemDto = z.infer<typeof updateCompraItemSchema>;
