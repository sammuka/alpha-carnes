import { z } from 'zod';
import { divergenciaInputSchema } from '../../recebimento/divergencia/dto/divergencia-recebimento.dto';
import { DESTINOS_RETIRADA } from './troca-peca.dto';

export const confirmarAssociacaoSchema = z.object({
  pedidoVendaItemId: z.string().uuid(),
});
export type ConfirmarAssociacaoDto = z.infer<typeof confirmarAssociacaoSchema>;

export const redirecionarSchema = z.object({
  pedidoVendaItemId: z.string().uuid(),
  motivo: z.string().trim().min(1, 'motivo é obrigatório').max(500),
});
export type RedirecionarDto = z.infer<typeof redirecionarSchema>;

/** Retira peça associada do pedido e destina a estoque ou desossa (modal Trocar Peça). */
export const destinarRetiradaSchema = z.object({
  destino: z.enum(DESTINOS_RETIRADA),
  motivo: z.string().trim().min(1, 'motivo é obrigatório').max(500),
  observacoes: z.string().trim().max(500).optional(),
});
export type DestinarRetiradaDto = z.infer<typeof destinarRetiradaSchema>;

export const DESTINOS_SEM_COBERTURA = ['sobra', 'analise', 'corte', 'divergencia'] as const;

/**
 * Destinação de peça sem cobertura (RF-PS-11/21/22). `sobra` exige motivo;
 * `divergencia` exige a classificação formal (reusa o contrato de F4a).
 */
export const semCoberturaSchema = z
  .object({
    destino: z.enum(DESTINOS_SEM_COBERTURA),
    motivo: z.string().trim().max(500).optional(),
    divergencia: divergenciaInputSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.destino === 'sobra' && !v.motivo) {
      // RF-PS-21
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'Informe o motivo para destinar à sobra.' });
    }
    if (v.destino === 'divergencia' && !v.divergencia) {
      // RF-PS-22
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['divergencia'], message: 'Classificação de divergência é obrigatória.' });
    }
  });
export type SemCoberturaDto = z.infer<typeof semCoberturaSchema>;

export const listarCompativeisRecebimentoSchema = z.object({
  produtoBaseId: z.string().uuid(),
  /** Inclui itens já completos (saldo 0). Usado pelo modal Trocar Peça. */
  incluirCompletos: z.coerce.boolean().optional().default(false),
});
export type ListarCompativeisRecebimentoDto = z.infer<typeof listarCompativeisRecebimentoSchema>;
