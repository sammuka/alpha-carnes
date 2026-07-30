import { z } from 'zod';

export const criarPedidoFornecedorSchema = z.object({
  compraProgramadaId: z.string().uuid(),
});

const statusPedidoFornecedorSchema = z.enum([
  'rascunho', 'enviado', 'aguardando_recebimento',
  'recebido', 'encerrado', 'cancelado',
]);
const paginaPedidoFornecedorSchema = {
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
};

export const listarPedidosFornecedorSchema = z.union([
  z.object({
    operacaoId: z.string().uuid(),
    status: statusPedidoFornecedorSchema.optional(),
    elegiveisRecebimento: z.never().optional(),
    ...paginaPedidoFornecedorSchema,
  }).strict(),
  z.object({
    elegiveisRecebimento: z.literal('true').transform(() => true as const),
    operacaoId: z.never().optional(),
    status: z.never().optional(),
    ...paginaPedidoFornecedorSchema,
  }).strict(),
]);

export const registrarNfSchema = z.object({
  numero: z.string().trim().min(1).max(60),
  serie: z.string().trim().max(30).optional(),
  chave: z.string().trim().max(60).optional(),
  dataEmissao: z.string().date().optional(),
  pesoTotalDeclarado: z.coerce.number().positive().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  itens: z.array(z.object({
    itemComercialId: z.string().uuid(),
    quantidadeDeclarada: z.coerce.number().positive(),
    pesoDeclarado: z.coerce.number().positive().optional(),
  })).min(1),
  /** Quando omitido, usa o recebimento mais recente do pedido. */
  recebimentoId: z.string().uuid().optional(),
});

export type CriarPedidoFornecedorDto =
  z.infer<typeof criarPedidoFornecedorSchema>;
export type ListarPedidosFornecedorDto =
  z.infer<typeof listarPedidosFornecedorSchema>;
export type RegistrarNfDto = z.infer<typeof registrarNfSchema>;
