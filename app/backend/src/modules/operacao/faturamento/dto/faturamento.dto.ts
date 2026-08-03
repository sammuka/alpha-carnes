import { z } from 'zod';
export { calcularRange, montarPaginado } from '../../../../common/crud/paginacao';

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

// ── D10.8 — listagem de notas ────────────────────────────────────────────────

export const listarNotasQuerySchema = z.object({
  status: z.enum(['pendente', 'emitida', 'erro_emissao', 'cancelada', 'erro_cancelamento']).optional(),
  caminhaoId: z.string().uuid().optional(),
  clienteId: z.string().uuid().optional(),
  busca: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarNotasQuery = z.infer<typeof listarNotasQuerySchema>;

// ── D10.5 — seguros de carga (F6b) ───────────────────────────────────────────

export const listarSegurosQuerySchema = z.object({
  status: z.enum(['pendente', 'enviado', 'confirmado']).optional(),
  busca: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarSegurosQuery = z.infer<typeof listarSegurosQuerySchema>;

export const criarSeguroSchema = z.object({ caminhaoId: z.string().uuid() });
export type CriarSeguroDto = z.infer<typeof criarSeguroSchema>;

export const alterarStatusSeguroSchema = z.object({
  status: z.enum(['pendente', 'enviado', 'confirmado']),
});
export type AlterarStatusSeguroDto = z.infer<typeof alterarStatusSeguroSchema>;

export const registrarAnexoSeguroSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(500).optional(),
});
export type RegistrarAnexoSeguroDto = z.infer<typeof registrarAnexoSeguroSchema>;

export const salvarObservacaoSeguroSchema = z.object({
  observacao: z.string().trim().max(2000),
});
export type SalvarObservacaoSeguroDto = z.infer<typeof salvarObservacaoSeguroSchema>;
