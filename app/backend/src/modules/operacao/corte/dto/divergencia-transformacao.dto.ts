import { z } from 'zod';

export const abrirDivergenciaTransformacaoSchema = z.object({
  tipo: z.enum([
    'subpeca_faltante',
    'subpeca_excedente',
    'produto_diferente',
    'perda_informada',
  ]),
  detalhe: z.record(z.string(), z.unknown()).default({}),
  observacao: z.string().trim().min(3).max(1000).optional(),
});
export type AbrirDivergenciaTransformacaoDto = z.infer<
  typeof abrirDivergenciaTransformacaoSchema
>;
