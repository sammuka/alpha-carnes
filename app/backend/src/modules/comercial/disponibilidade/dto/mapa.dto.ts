import { z } from 'zod';

export const consultarMapaSchema = z.object({
  operacaoId: z.string().uuid(),
  produtoId: z.string().uuid().optional(),
});
export type ConsultarMapaDto = z.infer<typeof consultarMapaSchema>;

export const drillDownSchema = consultarMapaSchema.extend({
  estado: z.enum(['F', 'V', 'R', 'C', 'D', 'O', 'E', '!']),
});
export type DrillDownDto = z.infer<typeof drillDownSchema>;

export type EstadoMapa = 'F' | 'V' | 'R' | 'C' | 'D' | 'O' | 'E' | '!';

export interface MapaProduto {
  produtoId: string;
  codigo: string;
  descricao: string;
  provisorio: boolean;
  estados: Record<EstadoMapa, string>;
  unidades: Record<EstadoMapa, number>;
  saldoComercial: string;
}
