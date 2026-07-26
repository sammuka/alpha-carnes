import { z } from 'zod';

export const consultarEspelhoSchema = z.object({
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dataOperacao deve ser YYYY-MM-DD'),
  agrupar: z.enum(['cliente', 'rota', 'representante']).default('cliente'),
  clienteId: z.string().uuid().optional(),
  rotaId: z.string().uuid().optional(),
  representanteId: z.string().uuid().optional(),
  busca: z.string().trim().max(120).optional(),
  formato: z.enum(['json', 'csv']).default('json'),
});
export type ConsultarEspelhoDto = z.infer<typeof consultarEspelhoSchema>;

export type StatusEspelho = 'Cancelado' | 'Faturado' | 'Fechado' | 'Atendido' | 'Parcial' | 'Aberto';

export interface EspelhoItem {
  pedidoVendaId: string;
  clienteId: string;
  cliente: string;
  representanteId: string | null;
  representante: string | null;
  rotaId: string | null;
  rota: string | null;
  itemComercialId: string;
  produto: string;
  unidade: string;
  quantidadePedida: string;
  quantidadeAtendida: string;
  pesoAtendido: string;
  status: StatusEspelho;
}

export interface EspelhoTotais {
  quantidadePedida: string;
  quantidadeAtendida: string;
  pesoAtendido: string;
}

export interface EspelhoGrupo {
  chave: string;
  itens: EspelhoItem[];
  subtotal: EspelhoTotais;
}

export interface EspelhoResposta {
  dataOperacao: string;
  agrupar: 'cliente' | 'rota' | 'representante';
  totalGeral: EspelhoTotais;
  grupos: EspelhoGrupo[];
}
