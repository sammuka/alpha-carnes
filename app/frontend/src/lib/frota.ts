export interface Caminhao {
  id: string;
  placa: string;
  descricao: string | null;
  capacidadeKg: number;
  rotaPadraoId: string | null;
  rotaPadraoNome: string | null;
  status: 'ativo' | 'inativo';
}

export interface Motorista {
  id: string;
  nome: string;
  documento: string;
  telefone: string | null;
  caminhaoPadraoId: string | null;
  caminhaoPadraoPlaca: string | null;
  caminhaoPadraoAtivo: boolean | null;
  status: 'ativo' | 'inativo';
}
