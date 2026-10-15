import { z } from 'zod';
import { normalizarPercentual } from '../percentual';

import { justificativaSchema as justificativaBase } from '../../enquadramentos/dto/comum.dto';

export { uuidSchema, versaoSchema } from '../../enquadramentos/dto/comum.dto';

/** PostgreSQL recusa NUL em text (500 sem tratamento). */
export const semNul = (valor: string): boolean => !valor.includes('\u0000');
export const MSG_NUL = 'Texto com caractere inválido.';

export const justificativaSchema = justificativaBase.refine(semNul, MSG_NUL);
export const textoCurtoSchema = (max: number) => z.string().trim().min(1).max(max).refine(semNul, MSG_NUL);

/** Data ISO com ano >= 1900: 0000-01-01 passa no z.iso.date mas derruba a leitura (500). */
export const dataVigenciaSchema = z.iso.date().refine((d) => Number(d.slice(0, 4)) >= 1900, 'Informe uma data a partir de 1900.');

export const percentualSchema = z.string().trim().transform((valor, ctx) => {
  const canon = normalizarPercentual(valor);
  if (!canon) {
    ctx.addIssue({ code: 'custom', message: 'Informe um percentual de 0,00 a 100,00.' });
    return z.NEVER;
  }
  return canon;
});

export const listarCatalogoQuerySchema = z.object({
  search: z.string().trim().refine(semNul, MSG_NUL).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarCatalogoQuery = z.infer<typeof listarCatalogoQuerySchema>;
