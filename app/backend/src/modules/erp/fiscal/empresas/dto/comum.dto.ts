import { z } from 'zod';
import { ufBrasilSchema } from '../../../../../common/dto/dominios.dto';

/** Justificativa obrigatória em toda mutação (D7): trim 3–500. */
export const justificativaSchema = z.string().trim().min(3).max(500);

/** Concorrência otimista (D14). */
export const versaoSchema = z.number().int().min(1);

/** Inscrição estadual/municipal: remove `.`, `/`, `-` e espaços, maiúsculas, `^[0-9A-Z]{1,20}$`. */
export const inscricaoSchema = z
  .string()
  .transform((v) => v.replace(/[./\-\s]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[0-9A-Z]{1,20}$/, 'Inscrição deve ter de 1 a 20 letras ou dígitos.'));

export const ufSchema = ufBrasilSchema;

export const nomeEstabelecimentoSchema = z.string().trim().min(1).max(120);

/** Corpo de submeter/aprovar/rejeitar/suspender/reativar. */
export const acaoDecisaoSchema = z.object({
  versao: versaoSchema,
  justificativa: justificativaSchema,
});
export type AcaoDecisaoDto = z.infer<typeof acaoDecisaoSchema>;

/** Corpo de DELETE (soft delete). */
export const removerSchema = z.object({
  justificativa: justificativaSchema,
});
export type RemoverDto = z.infer<typeof removerSchema>;

export const uuidParamSchema = z.string().uuid();
