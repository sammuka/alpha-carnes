import { z } from 'zod';

const quantidadeSchema = z
  .number()
  .positive('quantidade deve ser maior que zero')
  .max(9_999_999_999.999, 'quantidade fora do intervalo');

const itemPedidoSchema = z.object({
  itemComercialId: z.string().uuid(),
  quantidadePedida: quantidadeSchema,
  observacoes: z.string().trim().max(500).optional(),
});

export const createPedidoSchema = z.object({
  compraProgramadaId: z.string().uuid(),
  clienteId: z.string().uuid(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataOperacao deve ser YYYY-MM-DD'),
  dataEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataEntrega deve ser YYYY-MM-DD').optional(),
  rotaPrevista: z.string().trim().max(100).optional(),
  prioridade: z.number().int().min(0).max(100).optional(),
  observacoesGerais: z.string().trim().max(1000).optional(),
  itens: z.array(itemPedidoSchema).min(1, 'pedido precisa de ao menos um item'),
});

export type CreatePedidoDto = z.infer<typeof createPedidoSchema>;

// Reduzir (ou zerar) a quantidade reservada de um item — devolve saldo.
export const reduzirItemSchema = z.object({
  novaQuantidade: z.number().min(0).max(9_999_999_999.999),
});

export type ReduzirItemDto = z.infer<typeof reduzirItemSchema>;
