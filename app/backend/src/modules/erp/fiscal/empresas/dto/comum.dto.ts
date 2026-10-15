import { z } from 'zod';
import { ufBrasilSchema } from '../../../../../common/dto/dominios.dto';

/** U+0000 não é aceito pelo PostgreSQL em texto (causaria 500): recusado como 400. */
export const semNulo = (valor: string): boolean => !valor.includes('\u0000');
export const MENSAGEM_NULO = 'Texto contém caractere inválido.';

/** CNPJ/raiz: só ASCII `[0-9A-Za-z]` e máscara; `toUpperCase` Unicode (ı→I, ß→SS) não pode fabricar caracteres. */
export const CNPJ_ENTRADA_ASCII = /^[0-9A-Za-z./\-\s]*$/;
export const MENSAGEM_CNPJ_ASCII = 'CNPJ aceita apenas letras (A-Z) e dígitos.';

/** Justificativa obrigatória em toda mutação (D7): trim 3–500. */
export const justificativaSchema = z.string().trim().min(3).max(500).refine(semNulo, MENSAGEM_NULO);

/** Concorrência otimista (D14). */
export const versaoSchema = z.number().int().min(1);

/** Inscrição estadual/municipal: remove `.`, `/`, `-` e espaços, maiúsculas, `^[0-9A-Z]{1,20}$`. */
export const inscricaoSchema = z
  .string()
  .transform((v) => v.replace(/[./\-\s]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[0-9A-Z]{1,20}$/, 'Inscrição deve ter de 1 a 20 letras ou dígitos.'));

export const ufSchema = ufBrasilSchema;

export const nomeEstabelecimentoSchema = z.string().trim().min(1).max(120).refine(semNulo, MENSAGEM_NULO);

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
