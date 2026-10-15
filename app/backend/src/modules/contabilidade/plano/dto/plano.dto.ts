import { z } from 'zod';

const codigo = z.string().trim().min(1).max(32);
const texto180 = z.string().trim().min(1).max(180);
const motivo = z.string().trim().min(1).max(2000);
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const criarCentroSchema = z.object({
  codigo,
  nome: texto180,
  justificativa: motivo,
});

export const criarContaSchema = z.object({
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
}).refine((d) => d.vigenciaFim === null || d.vigenciaFim >= d.vigenciaInicio, {
  message: 'Fim de vigência anterior ao início de vigência',
});

export const listarPlanoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(180).default(''),
  situacao: z.enum(['', 'DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']).default(''),
  ordenar: z.enum(['contaContabil', 'naturezaConta', 'centroCusto', 'vigenciaInicio', 'vigenciaFim']).default('contaContabil'),
  direcao: z.enum(['asc', 'desc']).default('asc'),
});

export type CriarCentroDto = z.infer<typeof criarCentroSchema>;
export type CriarContaDto = z.infer<typeof criarContaSchema>;
export type ListarPlanoQuery = z.infer<typeof listarPlanoSchema>;
