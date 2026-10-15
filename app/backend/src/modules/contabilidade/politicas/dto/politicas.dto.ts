import { z } from 'zod';

const codigo = z.string().trim().min(1).max(32);
const motivo = z.string().trim().min(1).max(2000);
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const competencia = z.string().regex(/^\d{4}-\d{2}$/);
const tipoEvento = z.enum(['LIQUIDACAO', 'REGISTRO', 'CANCELAMENTO', 'ESTORNO', 'TARIFA']);

export const configurarSchema = z.object({
  tipoEvento,
  competencia,
  contaDebitoCodigo: codigo,
  contaCreditoCodigo: codigo,
  centroCodigo: codigo,
  vigenciaInicio: dataIso,
  justificativa: motivo,
});

export const editarSchema = z.object({
  numero: z.number().int().positive(),
  tipoEvento: tipoEvento.optional(),
  competencia: competencia.optional(),
  contaDebitoCodigo: codigo,
  contaCreditoCodigo: codigo,
  centroCodigo: codigo,
  vigenciaInicio: dataIso,
  justificativa: motivo,
});

export const listarPoliticasSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(180).default(''),
  situacao: z.enum(['', 'DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']).default(''),
  competencia: z.union([z.literal(''), competencia]).default(''),
  ordenar: z.enum(['competencia', 'contaDebito', 'contaCredito', 'centroCusto', 'tipoEvento']).default('competencia'),
  direcao: z.enum(['asc', 'desc']).default('asc'),
});

export type ConfigurarPoliticaDto = z.infer<typeof configurarSchema>;
export type EditarPoliticaDto = z.infer<typeof editarSchema>;
export type ListarPoliticasQuery = z.infer<typeof listarPoliticasSchema>;
