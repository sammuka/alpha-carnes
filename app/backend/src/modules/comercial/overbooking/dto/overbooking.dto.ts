import { z } from 'zod';

const statusPendenciaSchema = z.enum([
  'aberta', 'em_analise', 'compra_complementar_programada',
  'redistribuicao_decidida', 'novo_pedido_criado', 'resolvida', 'cancelada',
]);

export type StatusPendencia = z.infer<typeof statusPendenciaSchema>;

export const listarPendenciasSchema = z.object({
  operacaoId: z.string().uuid(),
  status: statusPendenciaSchema.optional(),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const decidirPendenciaSchema = z.discriminatedUnion('caminho', [
  z.object({
    caminho: z.literal('compra_complementar'),
    compraProgramadaId: z.string().uuid(),
    quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/),
    observacao: z.string().trim().max(500).optional(),
  }),
  z.object({
    caminho: z.literal('redistribuicao'),
    reservaOrigemId: z.string().uuid(),
    quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/),
    observacao: z.string().trim().max(500).optional(),
  }),
  z.object({
    caminho: z.literal('novo_pedido'),
    operacaoDestinoId: z.string().uuid(),
    quantidade: z.string().regex(/^\d+(\.\d{1,3})?$/),
    observacao: z.string().trim().max(500).optional(),
  }),
]);

export const alterarPendenciaSchema = z
  .object({
    status: statusPendenciaSchema,
    detalhe: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'cancelada') {
      const motivo = (v.detalhe as { motivo?: unknown }).motivo;
      if (typeof motivo !== 'string' || motivo.trim().length < 5) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['detalhe', 'motivo'], message: 'Informe o motivo do cancelamento (mínimo de 5 caracteres).' });
      }
    }
  });

export type ListarPendenciasDto = z.infer<typeof listarPendenciasSchema>;
export type DecidirPendenciaDto = z.infer<typeof decidirPendenciaSchema>;
export type AlterarPendenciaDto = z.infer<typeof alterarPendenciaSchema>;

export const STATUS_POR_CAMINHO = {
  compra_complementar: 'compra_complementar_programada',
  redistribuicao: 'redistribuicao_decidida',
  novo_pedido: 'novo_pedido_criado',
} as const;

export function statusDoCaminho(
  caminho: DecidirPendenciaDto['caminho'],
): StatusPendencia {
  return STATUS_POR_CAMINHO[caminho];
}

export const TRANSICOES_PENDENCIA: Record<StatusPendencia, readonly StatusPendencia[]> = {
  aberta: [
    'em_analise',
    'compra_complementar_programada',
    'redistribuicao_decidida',
    'novo_pedido_criado',
    'resolvida',
    'cancelada',
  ],
  em_analise: [
    'compra_complementar_programada',
    'redistribuicao_decidida',
    'novo_pedido_criado',
    'resolvida',
    'cancelada',
  ],
  compra_complementar_programada: ['resolvida'],
  redistribuicao_decidida: ['resolvida'],
  novo_pedido_criado: ['resolvida'],
  resolvida: [],
  cancelada: [],
};
