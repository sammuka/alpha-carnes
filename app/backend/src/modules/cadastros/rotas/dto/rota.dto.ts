import { z } from 'zod';
import { fkOpcionalSchema } from '../../../../common/dto/dominios.dto';

export const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;

const paradaSchema = z.object({
  ordem: z.coerce.number().int().min(1),
  descricao: z.string().trim().min(1).max(120),
});

export const createRotaSchema = z.object({
  codigo: z.string().trim().min(1).max(50),
  nome: z.string().trim().min(1).max(200),
  regiao: z.string().trim().max(100).optional(),
  representantePadraoId: fkOpcionalSchema,
  caminhaoPadraoId: fkOpcionalSchema,
  motoristaPadraoId: fkOpcionalSchema,
  observacoes: z.string().trim().optional(),
  paradas: z.array(paradaSchema).max(100).default([]),
  diasAtendimento: z.array(z.enum(DIAS_SEMANA)).max(7).default([]),
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
});

export type CreateRotaDto = z.infer<typeof createRotaSchema>;

export const updateRotaSchema = createRotaSchema.partial();
export type UpdateRotaDto = z.infer<typeof updateRotaSchema>;
