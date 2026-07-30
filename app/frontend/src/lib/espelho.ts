// Tipos do espelho comercial (D19/D20) — espelham `espelho.dto.ts` do backend.

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
