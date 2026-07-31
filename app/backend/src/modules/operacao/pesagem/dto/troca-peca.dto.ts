import { z } from 'zod';

export const DESTINOS_RETIRADA = ['estoque', 'desossa'] as const;
export type DestinoRetirada = (typeof DESTINOS_RETIRADA)[number];

/** Motivos de TrocaPeca.tsx:79-86, em slug estável. */
export const MOTIVOS_TROCA_PECA = [
  'peca_mais_adequada',
  'peso_fora_preferencia',
  'qualidade',
  'erro_associacao',
  'outro',
] as const;
export type MotivoTrocaPeca = (typeof MOTIVOS_TROCA_PECA)[number];

export const ROTULOS_MOTIVO_TROCA_PECA: Record<MotivoTrocaPeca, string> = {
  peca_mais_adequada: 'Peça mais adequada ao cliente',
  peso_fora_preferencia: 'Peso fora da preferência',
  qualidade: 'Qualidade',
  erro_associacao: 'Erro de associação',
  outro: 'Outro',
};

export const executarTrocaSchema = z
  .object({
    pecaRetiradaId: z.string().uuid(),
    pecaInseridaId: z.string().uuid(),
    pedidoVendaItemId: z.string().uuid(),
    destinoRetirada: z.enum(DESTINOS_RETIRADA),
    motivo: z.enum(MOTIVOS_TROCA_PECA),
    observacoes: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.pecaRetiradaId === v.pecaInseridaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pecaInseridaId'],
        message: 'peça de entrada precisa ser diferente da peça retirada',
      });
    }
    if (v.motivo === 'outro' && !v.observacoes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['observacoes'],
        message: 'observação é obrigatória quando o motivo é "Outro"',
      });
    }
  });
export type ExecutarTrocaDto = z.infer<typeof executarTrocaSchema>;
