import { z } from 'zod';

const tipoOperacionalSchema = z.enum([
  'peca_inteira_pesavel',
  'derivado_desossa',
  'entrada_unidade',
  'compra_base',
]);

const unidadePrecoSchema = z.enum(['kg', 'unidade']);

export const createProdutoSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  nome: z.string().trim().min(1).max(200),
  nomeOperacional: z.string().trim().max(200).optional(),
  categoria: z.string().trim().max(100).optional(),
  tipoOperacional: tipoOperacionalSchema.optional().default('peca_inteira_pesavel'),
  unidadePedido: z.string().trim().min(1).max(30),
  unidadePreco: unidadePrecoSchema.optional().default('kg'),
  exigePeso: z.boolean().optional().default(true),
  passaBalanca: z.boolean().optional().default(false),
  passaDesossa: z.boolean().optional().default(false),
  origemTransformacao: z.boolean().optional().default(false),
  saidaTransformacao: z.boolean().optional().default(false),
  podeEstoque: z.boolean().optional().default(true),
  ativoVenda: z.boolean().optional().default(true),
  ativoCompra: z.boolean().optional().default(false),
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
  observacoesOperacionais: z.string().trim().optional(),
  atributosJson: z.record(z.string(), z.unknown()).optional(),
});

export type CreateProdutoDto = z.infer<typeof createProdutoSchema>;

export const updateProdutoSchema = createProdutoSchema.partial();
export type UpdateProdutoDto = z.infer<typeof updateProdutoSchema>;
