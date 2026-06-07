import { z } from 'zod';

export const TIPOS_TRANSFORMACAO = ['simples', 'subdivisao', 'reclassificacao', 'destinacao_mista'] as const;
export const MOTIVOS_TRANSFORMACAO = ['preferencia_cliente', 'necessidade_operacional', 'divergencia', 'decisao_humana'] as const;

/** Abertura do corte de uma peça. */
export const iniciarCorteSchema = z
  .object({
    tipoTransformacao: z.enum(TIPOS_TRANSFORMACAO),
    motivo: z.enum(MOTIVOS_TRANSFORMACAO),
    motivoDetalhe: z.string().trim().max(500).optional(),
    observacoes: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.motivo === 'decisao_humana' && !v.motivoDetalhe) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivoDetalhe'], message: 'motivoDetalhe é obrigatório para decisão humana' });
    }
  });
export type IniciarCorteDto = z.infer<typeof iniciarCorteSchema>;

/** Conclusão do corte. justificativaDiferenca exigida quando há diferença de peso (regra dura no service). */
export const concluirCorteSchema = z.object({
  justificativaDiferenca: z.string().trim().max(1000).optional(),
});
export type ConcluirCorteDto = z.infer<typeof concluirCorteSchema>;
