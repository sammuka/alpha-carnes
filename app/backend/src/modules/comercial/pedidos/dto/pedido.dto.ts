import { z } from 'zod';
import { fkOpcionalSchema } from '../../../../common/dto/dominios.dto';

const quantidadeSchema = z
  .number()
  .positive('quantidade deve ser maior que zero')
  .max(9_999_999_999.999, 'quantidade fora do intervalo');

const itemPedidoSchema = z.object({
  produtoId: z.string().uuid(),
  quantidadePedida: quantidadeSchema,
  observacoes: z.string().trim().max(500).optional(),
});

const itensCriacaoPedidoSchema = z.array(itemPedidoSchema)
  .min(1, 'pedido precisa de ao menos um item')
  .superRefine((itens, ctx) => {
    const vistos = new Set<string>();
    itens.forEach((item, index) => {
      if (vistos.has(item.produtoId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'produtoId'],
          message: 'Produto duplicado no mesmo pedido.',
        });
      }
      vistos.add(item.produtoId);
    });
  });

export const createPedidoSchema = z.object({
  compraProgramadaId: z.string().uuid().optional(),
  operacaoId: z.string().uuid().optional(),
  clienteId: z.string().uuid(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da operação inválida — use o formato AAAA-MM-DD.').optional(),
  dataEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de entrega inválida — use o formato AAAA-MM-DD.').optional(),
  rotaId: fkOpcionalSchema,
  prioridade: z.number().int().min(0).max(100).optional(),
  observacoesGerais: z.string().trim().max(1000).optional(),
  salvarComoRascunho: z.boolean().optional().default(false),
  itens: itensCriacaoPedidoSchema,
}).strict().superRefine((val, ctx) => {
  if (!val.operacaoId && !val.dataOperacao) {
    ctx.addIssue({
      code: 'custom',
      message: 'Informe operacaoId ou dataOperacao',
    });
  }
});

export type CreatePedidoDto = z.infer<typeof createPedidoSchema>;

export const incluirItemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.coerce.number().positive(),
  observacoes: z.string().max(1000).optional(),
}).strict();

export const confirmarCriacaoOverbookingSchema = createPedidoSchema;
export const confirmarInclusaoOverbookingSchema = incluirItemSchema;
export type IncluirItemDto = z.infer<typeof incluirItemSchema>;
export type ConfirmarInclusaoOverbookingDto =
  z.infer<typeof confirmarInclusaoOverbookingSchema>;

export const reduzirItemSchema = z.object({
  novaQuantidade: z.coerce.number().positive().max(9_999_999_999.999),
  motivo: z.string().trim().min(1).max(1000),
}).strict();

export type ReduzirItemDto = z.infer<typeof reduzirItemSchema>;

export const cancelarPedidoSchema = z.object({
  motivo: z.string().trim().min(1).max(1000),
}).strict();

export type CancelarPedidoDto = z.infer<typeof cancelarPedidoSchema>;

export const removerItemSchema = z.object({
  motivo: z.string().trim().min(1).max(1000),
}).strict();

export type RemoverItemDto = z.infer<typeof removerItemSchema>;

export const buscarPedidoAbertoSchema = z.object({
  clienteId: z.string().uuid(),
  produtoId: z.string().uuid(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da operação inválida — use o formato AAAA-MM-DD.'),
}).strict();

export type BuscarPedidoAbertoDto = z.infer<typeof buscarPedidoAbertoSchema>;

export const liberarReservaSchema = z.object({
  justificativa: z.string().trim().min(10, 'justificativa deve ter ao menos 10 caracteres').max(1000),
}).strict();
export type LiberarReservaDto = z.infer<typeof liberarReservaSchema>;
