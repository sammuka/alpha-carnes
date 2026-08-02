import { z } from 'zod';

export const criarCaminhaoSchema = z
  .object({
    frotaCaminhaoId: z.string().uuid().optional(),
    placa: z.string().min(1).max(20).optional(),
    motorista: z.string().min(1).max(200),
    rota: z.string().max(500).optional(),
    itinerario: z.string().max(1000).optional(),
    dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
    observacoes: z.string().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.frotaCaminhaoId && !v.placa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['placa'],
        message: 'placa é obrigatória quando não há caminhão da frota vinculado',
      });
    }
  });
export type CriarCaminhaoDto = z.infer<typeof criarCaminhaoSchema>;

export const vincularPedidoSchema = z.object({
  pedidoVendaId: z.string().uuid(),
  ordemNaCarga: z.number().int().min(1).optional(),
});
export type VincularPedidoDto = z.infer<typeof vincularPedidoSchema>;

export const adicionarItemSchema = z.object({
  tipoOrigem: z.enum(['peca', 'subitem']),
  id: z.string().uuid(),
});
export type AdicionarItemDto = z.infer<typeof adicionarItemSchema>;

export const transferirItemSchema = z.object({
  pedidoVendaItemDestinoId: z.string().uuid(),
  motivo: z.string().min(1).max(500),
});
export type TransferirItemDto = z.infer<typeof transferirItemSchema>;

export const removerItemSchema = z.object({
  motivo: z.string().min(1).max(500),
});
export type RemoverItemDto = z.infer<typeof removerItemSchema>;

export const registrarItemConferenciaSchema = z
  .object({
    tipoOrigem: z.enum(['peca', 'subitem']),
    modoCaptura: z.enum(['automatico', 'manual_assistido']),
    codigo: z.string().optional(),
    motivo: z.string().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modoCaptura === 'manual_assistido') {
      if (!v.codigo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['codigo'],
          message: 'código é obrigatório na conferência manual',
        });
      }
      if (!v.motivo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['motivo'],
          message: 'motivo é obrigatório na conferência manual',
        });
      }
    }
  });
export type RegistrarItemConferenciaDto = z.infer<typeof registrarItemConferenciaSchema>;

export const fecharSchema = z
  .object({
    forcado: z.boolean().optional(),
    justificativa: z.string().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.forcado && !v.justificativa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['justificativa'],
        message: 'justificativa obrigatória ao forçar fechamento',
      });
    }
  });
export type FecharDto = z.infer<typeof fecharSchema>;

export const reabrirSchema = z.object({
  justificativa: z.string().min(1).max(500),
});
export type ReabrirDto = z.infer<typeof reabrirSchema>;

export const divergenciaConferenciaSchema = z.object({
  cargaItemId: z.string().uuid(),
  motivo: z.enum(['peca_ausente', 'peca_errada', 'peso_divergente', 'etiqueta_ilegivel', 'avaria', 'outro']),
  observacao: z.string().trim().max(1000).optional(),
});
export type DivergenciaConferenciaDto = z.infer<typeof divergenciaConferenciaSchema>;
