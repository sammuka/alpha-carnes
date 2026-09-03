import { z } from 'zod';
import { unidadeMedidaSchema } from '../../../../common/dto/dominios.dto';

export const createItemComercialSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  descricao: z.string().trim().min(1).max(200),
  categoria: z.string().trim().max(100).optional(),
  unidadeComercial: unidadeMedidaSchema,
  permiteCorte: z.boolean().optional().default(false),
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
  observacoesOperacionais: z.string().trim().optional(),
});

export type CreateItemComercialDto = z.infer<typeof createItemComercialSchema>;

export const updateItemComercialSchema = createItemComercialSchema.partial();
export type UpdateItemComercialDto = z.infer<typeof updateItemComercialSchema>;
