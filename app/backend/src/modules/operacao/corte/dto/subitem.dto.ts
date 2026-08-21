import { z } from 'zod';
import { MODOS_CAPTURA, MOTIVOS_CAPTURA_MANUAL } from '../../pesagem/dto/pesagem.dto';
import { divergenciaInputSchema } from '../../recebimento/divergencia/dto/divergencia-recebimento.dto';

/** Geração de um subitem (antes de pesar). itemComercialId pode reclassificar. */
export const adicionarSubitemSchema = z.object({
  itemComercialId: z.string().uuid(),
  classificacao: z.string().trim().max(200).optional(),
  quantidade: z.number().positive().max(9_999.999).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});
export type AdicionarSubitemDto = z.infer<typeof adicionarSubitemSchema>;

/** Pesagem do subitem — contrato ADR-009 idêntico ao da peça. */
export const pesarSubitemSchema = z
  .object({
    modoCaptura: z.enum(MODOS_CAPTURA),
    pesoManual: z.number().positive().max(9_999_999.999).optional(),
    motivo: z.enum(MOTIVOS_CAPTURA_MANUAL).optional(),
    motivoDetalhe: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modoCaptura === 'manual_assistido') {
      if (v.pesoManual === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pesoManual'], message: 'Informe o peso manual no modo manual assistido.' });
      if (!v.motivo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'motivo é obrigatório no modo manual assistido' });
      if (v.motivo === 'outro' && !v.motivoDetalhe) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivoDetalhe'], message: 'Detalhe o motivo ao selecionar "Outro".' });
    }
  });
export type PesarSubitemDto = z.infer<typeof pesarSubitemSchema>;

export const associarSubitemSchema = z.object({
  pedidoVendaItemId: z.string().uuid(),
});
export type AssociarSubitemDto = z.infer<typeof associarSubitemSchema>;

export const redirecionarSubitemSchema = z.object({
  pedidoVendaItemId: z.string().uuid(),
  motivo: z.string().trim().min(1, 'motivo é obrigatório').max(500),
});
export type RedirecionarSubitemDto = z.infer<typeof redirecionarSubitemSchema>;

export const DESTINOS_SUBITEM_SEM_COBERTURA = ['sobra', 'analise', 'divergencia'] as const;

export const semCoberturaSubitemSchema = z
  .object({
    destino: z.enum(DESTINOS_SUBITEM_SEM_COBERTURA),
    motivo: z.string().trim().max(500).optional(),
    divergencia: divergenciaInputSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.destino === 'sobra' && !v.motivo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'motivo é obrigatório para destinar à sobra' });
    if (v.destino === 'divergencia' && !v.divergencia) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['divergencia'], message: 'Classificação de divergência é obrigatória.' });
  });
export type SemCoberturaSubitemDto = z.infer<typeof semCoberturaSubitemSchema>;
