import { z } from 'zod';
import { unidadeMedidaSchema } from '../../../../common/dto/dominios.dto';

export const createItemCompraSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  descricao: z.string().trim().min(1).max(200),
  categoria: z.string().trim().max(100).optional(),
  unidadeCompra: unidadeMedidaSchema,
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
});

export type CreateItemCompraDto = z.infer<typeof createItemCompraSchema>;

export const updateItemCompraSchema = createItemCompraSchema.partial();
export type UpdateItemCompraDto = z.infer<typeof updateItemCompraSchema>;
