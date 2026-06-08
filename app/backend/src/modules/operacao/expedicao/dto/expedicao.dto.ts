import { z } from 'zod';

export const criarCaminhaoSchema = z.object({
  placa: z.string().min(1).max(20),
  motorista: z.string().min(1).max(200),
  rota: z.string().max(500).optional(),
  itinerario: z.string().max(1000).optional(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  observacoes: z.string().max(1000).optional(),
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
