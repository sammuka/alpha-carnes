import { z } from 'zod';

/** Justificativa obrigatória em toda mutação (D24): trim 3–500. */
export const justificativaSchema = z.string().trim().min(3).max(500);

/** Concorrência otimista (D17). */
export const versaoSchema = z.number().int().min(1);

export const uuidSchema = z.uuid();
