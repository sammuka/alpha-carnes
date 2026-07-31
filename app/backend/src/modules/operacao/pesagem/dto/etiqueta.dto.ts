import { z } from 'zod';

/**
 * Leitura de QR no fluxo de etiqueta/conferência. No modo manual (leitor
 * indisponível) exige código digitado + motivo (ADR-009); o código DEVE resolver
 * numa peça real (validado no service). Modo automático lê do gateway.
 */
export const resolverQrSchema = z
  .object({
    modoCaptura: z.enum(['automatico', 'manual_assistido']),
    codigo: z.string().trim().max(200).optional(),
    motivo: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modoCaptura === 'manual_assistido') {
      if (!v.codigo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['codigo'], message: 'codigo é obrigatório na leitura manual' });
      }
      if (!v.motivo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'motivo é obrigatório na leitura manual' });
      }
    }
  });
export type ResolverQrDto = z.infer<typeof resolverQrSchema>;

export const ESTADOS_ETIQUETA = [
  'emitida',
  'ativa',
  'invalidada_por_troca',
  'reimpressa',
  'cancelada',
] as const;
export type EstadoEtiqueta = (typeof ESTADOS_ETIQUETA)[number];

/** Motivos do modal "Cancelar etiqueta e estornar ação" — EtiquetasRecebimento.tsx:330-333. */
export const MOTIVOS_CANCELAMENTO_ETIQUETA = [
  'peso_incorreto',
  'pedido_incorreto',
  'destino_incorreto',
  'etiqueta_incorreta',
  'peca_incorreta',
  'outro',
] as const;
export type MotivoCancelamentoEtiqueta = (typeof MOTIVOS_CANCELAMENTO_ETIQUETA)[number];

export const ROTULOS_MOTIVO_CANCELAMENTO_ETIQUETA: Record<MotivoCancelamentoEtiqueta, string> = {
  peso_incorreto: 'Peso informado incorretamente',
  pedido_incorreto: 'Pedido selecionado incorretamente',
  destino_incorreto: 'Destino selecionado incorretamente',
  etiqueta_incorreta: 'Etiqueta impressa incorretamente',
  peca_incorreta: 'Peça identificada incorretamente',
  outro: 'Outro',
};

export const cancelarEtiquetaSchema = z
  .object({
    motivo: z.enum(MOTIVOS_CANCELAMENTO_ETIQUETA),
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
export type CancelarEtiquetaDto = z.infer<typeof cancelarEtiquetaSchema>;

/**
 * Filtros da matriz linha 16 (`GET /operacao/etiquetas?filtros`). `recebimentoId` é
 * **obrigatório** (emenda 3, menor 1 do veredito `daf9446`) — a tela de Etiquetas só existe
 * dentro de um lote selecionado (`etiquetas-client.tsx` já não navega sem `recebimentoId` na
 * rota), então tornar o filtro opcional deixaria a consulta varrer todas as etiquetas de todos
 * os recebimentos sem limite algum no banco.
 */
export const listarEtiquetasSchema = z.object({
  recebimentoId: z.string().uuid(),
  estado: z.enum(ESTADOS_ETIQUETA).optional(),
  busca: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(30),
});
export type ListarEtiquetasDto = z.infer<typeof listarEtiquetasSchema>;
