/** Rótulos idênticos a ModelosEtiqueta.tsx linhas 18–31 — sem reescrita. */
export const CAMPOS_ETIQUETA = [
  { chave: 'codigo', rotulo: 'Código' },
  { chave: 'produto', rotulo: 'Produto' },
  { chave: 'peso', rotulo: 'Peso' },
  { chave: 'clientePedido', rotulo: 'Cliente/Pedido' },
  { chave: 'destino', rotulo: 'Destino' },
  { chave: 'origemFrigorifico', rotulo: 'Origem/Frigorífico' },
  { chave: 'nfLote', rotulo: 'NF/Lote' },
  { chave: 'dataHora', rotulo: 'Data/hora' },
  { chave: 'operador', rotulo: 'Operador' },
  { chave: 'caracteristicas', rotulo: 'Características' },
  { chave: 'qrCode', rotulo: 'QR Code' },
  { chave: 'codigoBarras', rotulo: 'Código de barras' },
] as const;

export type CampoEtiqueta = (typeof CAMPOS_ETIQUETA)[number]['chave'];

export interface ModeloEtiqueta {
  id: string;
  slug: string;
  nome: string;
  campos: Record<CampoEtiqueta, boolean>;
  status: 'ativo' | 'inativo';
}
