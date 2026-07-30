// Tipos do mapa teatro de disponibilidade (D17) — espelham `mapa.dto.ts` do backend.

export type EstadoMapa = 'F' | 'V' | 'R' | 'C' | 'D' | 'O' | 'E' | '!';

export interface MapaProduto {
  itemComercialId: string;
  codigo: string;
  descricao: string;
  provisorio: boolean;
  estados: Record<EstadoMapa, string>;
  unidades: Record<EstadoMapa, number>;
  saldoComercial: string;
}

export interface DetalhePeca {
  id: string;
  etiqueta_atual: string | null;
  peso_original: string;
  status_peca: string;
  recebimento_id: string;
}

export interface DetalheVirtual {
  id: string;
  quantidade_disponivel: string;
  compra_programada_id: string;
  numero_interno: string | null;
}

export interface DetalheExpedido {
  carga_item_id: string;
  caminhao_id: string;
  placa: string;
  status_caminhao: string;
  tipo_origem: string;
  etiqueta_atual: string | null;
}

export interface DetalheReserva {
  id: string;
  quantidade_reservada: string;
  tipo_consumo: string;
  pedido_venda_id: string;
  status_pedido: string;
  cliente_id: string;
  razao_social: string;
}

export type DetalheMapa = DetalhePeca | DetalheVirtual | DetalheExpedido | DetalheReserva;
