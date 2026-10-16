import { z } from 'zod';
import { normalizarPercentual } from '../percentual';

import { buscaSchema } from '../../enquadramentos/dto/comum.dto';

export { buscaSchema, justificativaSchema, uuidSchema, versaoSchema } from '../../enquadramentos/dto/comum.dto';

export const percentualSchema = z.string().trim().transform((valor, ctx) => {
  const canon = normalizarPercentual(valor);
  if (!canon) {
    ctx.addIssue({ code: 'custom', message: 'Informe um percentual de 0,00 a 100,00.' });
    return z.NEVER;
  }
  return canon;
});

export const listarCatalogoQuerySchema = z.object({
  search: buscaSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarCatalogoQuery = z.infer<typeof listarCatalogoQuerySchema>;
