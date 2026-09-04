import { z } from 'zod';

export const UNIDADES_MEDIDA = ['kg', 'unidade'] as const;
export const unidadeMedidaSchema = z.enum(UNIDADES_MEDIDA);
export type UnidadeMedida = z.infer<typeof unidadeMedidaSchema>;

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
export const ufBrasilSchema = z.enum(UFS_BRASIL);
export type UfBrasil = z.infer<typeof ufBrasilSchema>;

export const fkOpcionalSchema = z.string().uuid().nullable().optional();
