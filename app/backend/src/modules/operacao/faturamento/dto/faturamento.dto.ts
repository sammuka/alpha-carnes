import { z } from 'zod';

export const emitirNfseSchema = z.object({
  pedidoVendaId: z.string().uuid(),
  valor: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor deve ser numérico com até 2 casas decimais')
    .refine((v) => parseFloat(v) > 0, { message: 'Valor deve ser maior que zero' }),
  aliquota: z.string().regex(/^0\.\d{4}$/).optional(),
  codigoServico: z.string().min(1).max(20).optional(),
});
export type EmitirNfseDto = z.infer<typeof emitirNfseSchema>;

export const cancelarNfseSchema = z.object({
  motivo: z.string().min(1).max(500),
});
export type CancelarNfseDto = z.infer<typeof cancelarNfseSchema>;

export const reprocessarNfseSchema = z.object({});
export type ReprocessarNfseDto = z.infer<typeof reprocessarNfseSchema>;
