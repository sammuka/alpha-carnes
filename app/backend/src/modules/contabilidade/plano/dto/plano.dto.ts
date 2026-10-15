import { z } from 'zod';

const codigo = z.string().trim().min(1).max(32);
const texto180 = z.string().trim().min(1).max(180);
const motivo = z.string().trim().min(1).max(2000);
export function dataCalendarioValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

const dataIso = z.string().refine(dataCalendarioValida, { message: 'Data inexistente no calendário' });

export const criarCentroSchema = z.object({
  codigo,
  nome: texto180,
  justificativa: motivo,
});

const criarContaCampos = z.object({
  codigo,
  nome: texto180,
  classificacao: z.enum(['sintetica', 'analitica']),
  natureza: z.enum(['ATIVO', 'PASSIVO', 'RECEITA', 'DESPESA', 'CUSTO']),
  grupo: texto180,
  contaPaiCodigo: codigo.nullable(),
  centroCodigo: codigo,
  vigenciaInicio: dataIso,
  vigenciaFim: dataIso.nullable(),
  justificativa: motivo,
});

const vigenciaCoerente = (d: { vigenciaInicio: string; vigenciaFim: string | null }) =>
  d.vigenciaFim === null || d.vigenciaFim >= d.vigenciaInicio;

export const criarContaSchema = criarContaCampos.refine(vigenciaCoerente, {
  message: 'Fim de vigência anterior ao início de vigência',
});

export const listarPlanoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(180).default(''),
  situacao: z.enum(['', 'DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']).default(''),
  ordenar: z.enum(['contaContabil', 'naturezaConta', 'centroCusto', 'vigenciaInicio', 'vigenciaFim']).default('contaContabil'),
  direcao: z.enum(['asc', 'desc']).default('asc'),
});

export const editarSchema = criarContaCampos.omit({ codigo: true }).extend({
  numero: z.number().int().positive(),
}).refine(vigenciaCoerente, {
  message: 'Fim de vigência anterior ao início de vigência',
});

export const revisarSchema = z.object({
  numero: z.number().int().positive(),
  vigenciaInicio: dataIso,
  vigenciaFim: dataIso.nullable(),
  justificativa: motivo,
});

export const decidirSchema = z.object({
  numero: z.number().int().positive(),
  justificativa: motivo,
});

export const mapearSchema = z.object({
  numero: z.number().int().positive(),
  centroCodigo: codigo,
  justificativa: motivo,
});

export const acaoSchema = {
  editar: editarSchema,
  versionar: editarSchema,
  'revisar-competencia': revisarSchema,
  aprovar: decidirSchema,
  bloquear: decidirSchema,
  mapear: mapearSchema,
} as const;

export const loteSchema = z.object({
  acao: z.enum(['revisar-competencia', 'aprovar', 'bloquear']),
  codigos: z.array(codigo).min(1).max(20),
  justificativa: motivo,
  numeroPorCodigo: z.record(z.string(), z.number().int().positive()),
});

export type CriarCentroDto = z.infer<typeof criarCentroSchema>;
export type CriarContaDto = z.infer<typeof criarContaSchema>;
export type ListarPlanoQuery = z.infer<typeof listarPlanoSchema>;
export type EditarContaDto = z.infer<typeof editarSchema>;
export type RevisarCompetenciaDto = z.infer<typeof revisarSchema>;
export type DecidirContaDto = z.infer<typeof decidirSchema>;
export type MapearContaDto = z.infer<typeof mapearSchema>;
export type LoteDto = z.infer<typeof loteSchema>;
