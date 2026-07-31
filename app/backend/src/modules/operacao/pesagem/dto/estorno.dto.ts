import { z } from 'zod';

export const MOTIVOS_ESTORNO = [
  'peso_incorreto',
  'pedido_incorreto',
  'destino_incorreto',
  'etiqueta_incorreta',
  'outro',
] as const;
export type MotivoEstorno = (typeof MOTIVOS_ESTORNO)[number];

export const ROTULOS_MOTIVO_ESTORNO: Record<MotivoEstorno, string> = {
  peso_incorreto: 'Peso informado incorretamente',
  pedido_incorreto: 'Pedido selecionado incorretamente',
  destino_incorreto: 'Destino selecionado incorretamente',
  etiqueta_incorreta: 'Etiqueta impressa incorretamente',
  outro: 'Outro',
};

export const estornarSchema = z
  .object({
    motivo: z.enum(MOTIVOS_ESTORNO),
    observacoes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.motivo === 'outro' && !v.observacoes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['observacoes'],
        message: 'observação é obrigatória quando o motivo é "Outro"',
      });
    }
  });
export type EstornarDto = z.infer<typeof estornarSchema>;
