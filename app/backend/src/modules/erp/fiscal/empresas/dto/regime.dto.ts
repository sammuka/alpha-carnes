import { z } from 'zod';
import { CODIGOS_CRT } from '../../../../../database/schema/fiscal-empresas.schema';
import { acaoDecisaoSchema, justificativaSchema, versaoSchema } from './comum.dto';

/** Ano >= 1900: o PostgreSQL rejeita ano 0000 (500); datas fiscais anteriores a 1900 não existem. */
const dataIsoSchema = z.iso.date().refine((data) => data >= '1900-01-01', { message: 'Data deve ser a partir de 1900.' });

const MENSAGEM_VIGENCIA = 'Fim de vigência deve ser igual ou posterior ao início.';

function vigenciaOrdenada(v: { vigenciaInicio?: string; vigenciaFim?: string }): boolean {
  return !v.vigenciaInicio || !v.vigenciaFim || v.vigenciaFim >= v.vigenciaInicio;
}

export const createRegimeSchema = z
  .object({
    crt: z.enum(CODIGOS_CRT),
    vigenciaInicio: dataIsoSchema,
    vigenciaFim: dataIsoSchema.optional(),
    justificativa: justificativaSchema,
  })
  .strict()
  .refine(vigenciaOrdenada, { message: MENSAGEM_VIGENCIA, path: ['vigenciaFim'] });
export type CreateRegimeDto = z.infer<typeof createRegimeSchema>;

export const updateRegimeSchema = z
  .object({
    crt: z.enum(CODIGOS_CRT).optional(),
    vigenciaInicio: dataIsoSchema.optional(),
    vigenciaFim: dataIsoSchema.optional(),
    versao: versaoSchema,
    justificativa: justificativaSchema,
  })
  .strict()
  .refine(vigenciaOrdenada, { message: MENSAGEM_VIGENCIA, path: ['vigenciaFim'] });
export type UpdateRegimeDto = z.infer<typeof updateRegimeSchema>;

/** Submissão com challenge de troca (D8): `confirmarTroca` reenviado após o 409. */
export const submeterRegimeSchema = acaoDecisaoSchema.extend({
  confirmarTroca: z.boolean().optional(),
});
export type SubmeterRegimeDto = z.infer<typeof submeterRegimeSchema>;
