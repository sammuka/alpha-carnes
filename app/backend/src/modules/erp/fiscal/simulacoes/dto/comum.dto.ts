import { z } from 'zod';
import { centavosDe, normalizarDinheiro, normalizarEscala } from '../decimal-memoria';

export { justificativaSchema, uuidSchema, versaoSchema } from '../../enquadramentos/dto/comum.dto';

export const dinheiroSchema = z.string().trim().transform((valor, ctx) => {
  const canon = normalizarDinheiro(valor);
  if (!canon) {
    ctx.addIssue({ code: 'custom', message: 'Informe um valor com até duas casas decimais.' });
    return z.NEVER;
  }
  return canon;
});

export const quantidadeSchema = z.string().trim().transform((valor, ctx) => {
  const canon = normalizarEscala(valor, 12);
  if (!canon || canon === '0.000') {
    ctx.addIssue({ code: 'custom', message: 'Informe uma quantidade maior que zero, com até três casas.' });
    return z.NEVER;
  }
  return canon;
});

export const pesoSchema = z.string().trim().transform((valor, ctx) => {
  const canon = normalizarEscala(valor, 7);
  if (!canon || canon === '0.000') {
    ctx.addIssue({ code: 'custom', message: 'Informe o peso informado na nota (kg) maior que zero, com até três casas.' });
    return z.NEVER;
  }
  return canon;
});

export const competenciaSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Informe a competência como AAAA-MM.');

export const valorSchema = dinheiroSchema.refine((canon) => centavosDe(canon) > 0n, {
  message: 'Informe um valor maior que zero.',
});
