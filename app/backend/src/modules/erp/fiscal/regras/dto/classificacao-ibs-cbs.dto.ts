import { z } from 'zod';
import { justificativaSchema, listarCatalogoQuerySchema } from './comum.dto';

export const classificacaoIbsCbsSchema = z.object({
  codigo: z.string().trim().regex(/^[0-9]{6}$/),
  descricao: z.string().trim().min(1).max(255),
  justificativa: justificativaSchema,
}).strict();
export type ClassificacaoIbsCbsDto = z.infer<typeof classificacaoIbsCbsSchema>;

export { listarCatalogoQuerySchema };
export type ListarClassificacoesQuery = z.infer<typeof listarCatalogoQuerySchema>;
