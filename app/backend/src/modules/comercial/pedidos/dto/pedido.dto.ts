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

const itensCriacaoPedidoSchema = z.array(itemPedidoSchema)
  .min(1, 'pedido precisa de ao menos um item')
  .superRefine((itens, ctx) => {
    const vistos = new Set<string>();
    itens.forEach((item, index) => {
      if (vistos.has(item.itemComercialId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'itemComercialId'],
          message: 'item comercial duplicado no mesmo pedido',
        });
      }
      vistos.add(item.itemComercialId);
    });
  });

export const createPedidoSchema = z.object({
  compraProgramadaId: z.string().uuid(),
  clienteId: z.string().uuid(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataOperacao deve ser YYYY-MM-DD'),
  dataEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataEntrega deve ser YYYY-MM-DD').optional(),
  rotaPrevista: z.string().trim().max(100).optional(),
  prioridade: z.number().int().min(0).max(100).optional(),
  observacoesGerais: z.string().trim().max(1000).optional(),
  itens: itensCriacaoPedidoSchema,
});

export type CreatePedidoDto = z.infer<typeof createPedidoSchema>;

export const incluirItemSchema = z.object({
  itemComercialId: z.string().uuid(),
  quantidade: z.coerce.number().positive(),
  observacoes: z.string().max(1000).optional(),
});

export const confirmarCriacaoOverbookingSchema = createPedidoSchema;
// Inclusão sempre cria uma nova linha. Aumento/redução de linha existente usa
// os endpoints explícitos de alteração de item; não há itemId ambíguo aqui.
export const confirmarInclusaoOverbookingSchema = incluirItemSchema;
export type IncluirItemDto = z.infer<typeof incluirItemSchema>;
export type ConfirmarInclusaoOverbookingDto =
  z.infer<typeof confirmarInclusaoOverbookingSchema>;

export const reduzirItemSchema = z.object({
  novaQuantidade: z.coerce.number().positive().max(9_999_999_999.999),
  motivo: z.string().trim().min(1).max(1000),
});

export type ReduzirItemDto = z.infer<typeof reduzirItemSchema>;

export const cancelarPedidoSchema = z.object({
  motivo: z.string().trim().min(1).max(1000),
});

export type CancelarPedidoDto = z.infer<typeof cancelarPedidoSchema>;

export const removerItemSchema = z.object({
  motivo: z.string().trim().min(1).max(1000),
});

export type RemoverItemDto = z.infer<typeof removerItemSchema>;

export const buscarPedidoAbertoSchema = z.object({
  clienteId: z.string().uuid(),
  itemComercialId: z.string().uuid(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataOperacao deve ser YYYY-MM-DD'),
});

export type BuscarPedidoAbertoDto = z.infer<typeof buscarPedidoAbertoSchema>;
