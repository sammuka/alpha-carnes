import { z } from 'zod';

/**
 * Campos de DTO seguros por padrão (AD-41). `scripts/lint-dto-zod.mjs` proíbe `z.string()` cru e
 * data ISO sem piso em arquivos `dto/`: texto livre usa `textoSchema()`, data usa `dataIsoSchema()`.
 */

/** Texto livre: recusa o byte NUL (o PostgreSQL rejeita `\u0000` em TEXT e devolveria 500). */
export function textoSchema() {
  return z.string().refine((valor) => !valor.includes('\u0000'), { message: 'Caractere inválido no texto' });
}

/** Data `AAAA-MM-DD` real (sem 30/02) com ano a partir de 1900. */
export function dataIsoSchema() {
  return z.iso.date().refine((valor) => Number(valor.slice(0, 4)) >= 1900, { message: 'Ano anterior a 1900' });
}
