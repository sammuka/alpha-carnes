import { z } from 'zod';
import { divergenciaInputSchema } from '../divergencia/dto/divergencia-recebimento.dto';

/** Início do recebimento: vínculo com a compra programada confirmada do dia. */
export const iniciarRecebimentoSchema = z.object({
  compraProgramadaId: z.string().uuid(),
  dataHoraChegada: z.string().datetime().optional(),
  notaFiscalFornecedor: z.string().trim().max(100).optional(),
  placaVeiculo: z.string().trim().max(20).optional(),
  motorista: z.string().trim().max(200).optional(),
  doca: z.string().trim().max(50).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});

export type IniciarRecebimentoDto = z.infer<typeof iniciarRecebimentoSchema>;

const quantidadeSchema = z
  .number()
  .nonnegative('quantidadeRecebida não pode ser negativa')
  .max(9_999_999_999.999, 'quantidade fora do intervalo');

/**
 * Registro de item recebido. Qualquer diferença esperado×recebido (ou item
 * excedente) EXIGE a classificação de divergência inline (ajuste sem ocorrência
 * formal é rejeitado pelo service — RA-06).
 */
export const registrarItemSchema = z.object({
  itemComercialId: z.string().uuid(),
  quantidadeRecebida: quantidadeSchema,
  pesoTotalApurado: z.number().nonnegative().max(9_999_999.999).optional(),
  observacoes: z.string().trim().max(1000).optional(),
  divergencia: divergenciaInputSchema.optional(),
});

export type RegistrarItemDto = z.infer<typeof registrarItemSchema>;
