import { z } from 'zod';
import { listarQuerySchema } from '../../../../common/crud/paginacao';
import { fkOpcionalSchema } from '../../../../common/dto/dominios.dto';

export const listarEntradasQuerySchema = listarQuerySchema;
export type ListarEntradasQuery = z.infer<typeof listarEntradasQuerySchema>;

export const listarAjustesQuerySchema = listarQuerySchema.extend({
  status: z.enum(['aplicado', 'aguardando_aprovacao', 'rejeitado']).optional(),
});
export type ListarAjustesQuery = z.infer<typeof listarAjustesQuerySchema>;

export const compativeisEntradaPorProdutoQuerySchema = z.object({
  produtoId: z.string().uuid(),
});
export type CompativeisEntradaPorProdutoQuery = z.infer<typeof compativeisEntradaPorProdutoQuerySchema>;

export const consultaEstoqueQuerySchema = z.object({
  status: z.enum(['disponivel', 'destinado', 'em_desossa', 'bloqueado']).optional(),
  produtoId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
});
export type ConsultaEstoqueQuery = z.infer<typeof consultaEstoqueQuerySchema>;

export const destinarSchema = z
  .object({
    tipo: z.enum(['peca', 'subitem', 'entrada']),
    id: z.string().uuid(),
    pedidoVendaItemId: z.string().uuid(),
    quantidade: z.number().int().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === 'entrada' && !v.quantidade) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantidade'], message: 'quantidade é obrigatória para entrada' });
    }
    if (v.tipo !== 'entrada' && v.quantidade !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantidade'], message: 'quantidade só se aplica a entrada' });
    }
  });
export type DestinarDto = z.infer<typeof destinarSchema>;

export const criarEntradaSchema = z
  .object({
    produtoId: z.string().uuid(),
    quantidade: z.number().int().min(1),
    unidade: z.enum(['caixa', 'unidade']).default('caixa'),
    fornecedorId: z.string().uuid(),
    loteNf: z.string().trim().max(120).optional(),
    local: z.string().trim().max(60).optional(),
    destino: z.enum(['estoque', 'pedido']),
    pedidoVendaItemId: fkOpcionalSchema,
    observacao: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.destino === 'pedido' && !v.pedidoVendaItemId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pedidoVendaItemId'], message: 'Selecione o item do pedido ao destinar para pedido.' });
    }
  });
export type CriarEntradaDto = z.infer<typeof criarEntradaSchema>;

export const criarAjusteSchema = z.object({
  tipo: z.enum(['peca', 'subitem', 'entrada']),
  id: z.string().uuid(),
  quantidadeDelta: z.number().int().refine((n) => n !== 0, 'delta não pode ser zero'),
  motivo: z.enum(['quebra', 'perda', 'erro_contagem', 'vencimento', 'outro']),
  descricao: z.string().trim().max(2000).optional(),
});
export type CriarAjusteDto = z.infer<typeof criarAjusteSchema>;

export const rejeitarAjusteSchema = z.object({
  motivo: z.string().trim().min(5).max(1000),
});
export type RejeitarAjusteDto = z.infer<typeof rejeitarAjusteSchema>;

export const historicoParamsSchema = z.object({
  tipo: z.enum(['peca', 'subitem', 'entrada']),
  id: z.string().uuid(),
});
export type HistoricoParams = z.infer<typeof historicoParamsSchema>;
