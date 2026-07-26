import { z } from 'zod';

const statusOperacaoSchema = z.enum(['aberta', 'em_andamento', 'fechada']);

export const listarOperacoesSchema = z.object({
  de: z.string().date().optional(),
  ate: z.string().date().optional(),
  status: statusOperacaoSchema.optional(),
  extraordinaria: z.union([z.boolean(), z.string()]).optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
}).refine(({ de, ate }) => !de || !ate || de <= ate, {
  message: 'de deve ser anterior ou igual a ate',
});

export type ListarOperacoesDto = z.infer<typeof listarOperacoesSchema>;

export interface OperacaoComContadores {
  id: string;
  data: string;
  diaSemana: number;
  rotulo: string;
  status: 'aberta' | 'em_andamento' | 'fechada';
  extraordinaria: boolean;
  comprasProgramadas: number;
  pedidosVenda: number;
  pendenciasOverbookingAbertas: number;
}

export const criarExtraordinariaSchema = z.object({
  data: z.string().date(),
  rotulo: z.string().trim().min(1).max(120),
});

export const gerarCadenciaSchema = z.object({
  de: z.string().date(),
  ate: z.string().date(),
}).refine(({ de, ate }) => de <= ate, { message: 'de deve ser anterior ou igual a ate' });

export const alterarStatusOperacaoSchema = z.object({
  status: statusOperacaoSchema,
});

export type StatusOperacao = z.infer<typeof statusOperacaoSchema>;
export type CriarExtraordinariaDto = z.infer<typeof criarExtraordinariaSchema>;
export type GerarCadenciaDto = z.infer<typeof gerarCadenciaSchema>;
export type AlterarStatusOperacaoDto = z.infer<typeof alterarStatusOperacaoSchema>;
