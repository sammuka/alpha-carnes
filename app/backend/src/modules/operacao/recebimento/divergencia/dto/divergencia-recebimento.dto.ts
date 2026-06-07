import { z } from 'zod';

export const TIPOS_DIVERGENCIA = [
  'quantidade_menor',
  'quantidade_maior',
  'item_divergente',
  'qualidade_divergente',
  'peso_incompativel',
  'item_ausente',
  'item_excedente',
  'inconsistencia_nf_fisico',
] as const;

export const STATUS_DIVERGENCIA = ['aberta', 'em_analise', 'aguardando_fornecedor', 'resolvida'] as const;

/** Classificação obrigatória de uma divergência (RA-06). */
export const divergenciaInputSchema = z.object({
  tipo: z.enum(TIPOS_DIVERGENCIA),
  descricao: z.string().trim().min(1, 'descricao é obrigatória').max(2000),
  acaoImediata: z.string().trim().min(1, 'acaoImediata é obrigatória').max(2000),
  impactoOperacional: z.string().trim().max(2000).optional(),
  impactoComercial: z.string().trim().max(2000).optional(),
});

export type DivergenciaInput = z.infer<typeof divergenciaInputSchema>;

/** Abertura avulsa de divergência sobre um item já existente. */
export const abrirDivergenciaSchema = divergenciaInputSchema;
export type AbrirDivergenciaDto = z.infer<typeof abrirDivergenciaSchema>;

/** Transição/atualização auditada da divergência (tratativa). */
export const atualizarDivergenciaSchema = z
  .object({
    status: z.enum(STATUS_DIVERGENCIA).optional(),
    impactoOperacional: z.string().trim().max(2000).optional(),
    impactoComercial: z.string().trim().max(2000).optional(),
    acaoImediata: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'informe ao menos um campo para atualizar' });

export type AtualizarDivergenciaDto = z.infer<typeof atualizarDivergenciaSchema>;
