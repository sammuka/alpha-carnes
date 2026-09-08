import { z } from 'zod';
import { divergenciaInputSchema } from '../divergencia/dto/divergencia-recebimento.dto';

const pesoNfSchema = z.number().nonnegative().max(9_999_999.999);
const volumesNfSchema = z.number().nonnegative().max(9_999_999_999.999);

const nfeNumeroOpcionalSchema = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v ? v : undefined));

const nfeChaveOpcionalSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' || v === undefined ? undefined : v))
  .refine((v) => v === undefined || /^\d{44}$/.test(v), {
    message: 'Chave da NF-e deve ter 44 dígitos',
  });

/** Abertura do lote de recebimento exclusivamente a partir do Pedido ao Fornecedor. */
export const iniciarRecebimentoSchema = z.object({
  pedidoFornecedorId: z.string().uuid(),
  nfeNumero: nfeNumeroOpcionalSchema,
  nfeSerie: z.string().trim().max(20).optional(),
  nfeChave: nfeChaveOpcionalSchema,
  nfeDataEmissao: z.string().date().optional(),
  romaneio: z.string().trim().max(100).optional(),
  nfePesoBruto: pesoNfSchema.optional(),
  nfePesoLiquido: pesoNfSchema.optional(),
  nfeVolumes: volumesNfSchema.optional(),
  dataHoraChegada: z.string().datetime().optional(),
  placaVeiculo: z.string().trim().max(20).optional(),
  motorista: z.string().trim().max(200).optional(),
  doca: z.string().trim().max(50).optional(),
  observacoes: z.string().trim().max(1000).optional(),
}).strict();

export type IniciarRecebimentoDto = z.infer<typeof iniciarRecebimentoSchema>;

export const atualizarNfeSchema = z.object({
  nfeNumero: nfeNumeroOpcionalSchema,
  nfeSerie: z.string().trim().max(20).optional(),
  nfeChave: nfeChaveOpcionalSchema,
  nfeDataEmissao: z.string().date().optional(),
  romaneio: z.string().trim().max(100).optional(),
  nfePesoBruto: pesoNfSchema.optional(),
  nfePesoLiquido: pesoNfSchema.optional(),
  nfeVolumes: volumesNfSchema.optional(),
  placaVeiculo: z.string().trim().max(20).optional(),
  motorista: z.string().trim().max(200).optional(),
  doca: z.string().trim().max(50).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});

export type AtualizarNfeDto = z.infer<typeof atualizarNfeSchema>;

/** Metadados operacionais do lote (placa, motorista, doca). */
export const atualizarMetadadosLoteSchema = z.object({
  placaVeiculo: z.string().trim().max(20).optional(),
  motorista: z.string().trim().max(200).optional(),
  doca: z.string().trim().max(50).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});

export type AtualizarMetadadosLoteDto = z.infer<typeof atualizarMetadadosLoteSchema>;

const quantidadeSchema = z
  .number()
  .nonnegative('quantidadeRecebida não pode ser negativa')
  .max(9_999_999_999.999, 'quantidade fora do intervalo');

export const registrarItemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidadeRecebida: quantidadeSchema,
  pesoTotalApurado: z.number().nonnegative().max(9_999_999.999).optional(),
  observacoes: z.string().trim().max(1000).optional(),
  divergencia: divergenciaInputSchema.optional(),
});

export type RegistrarItemDto = z.infer<typeof registrarItemSchema>;
