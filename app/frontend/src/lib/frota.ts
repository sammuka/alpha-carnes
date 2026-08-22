export interface Caminhao {
  id: string;
  placa: string;
  descricao: string | null;
  capacidadeKg: number;
  rotaPadraoId: string | null;
  rotaPadraoNome: string | null;
  status: 'ativo' | 'inativo';
  fabricante: string | null;
  modelo: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string | null;
  chassi: string | null;
  certificadoNumero: string | null;
  certificadoCidade: string | null;
  certificadoUf: string | null;
  certificadoData: string | null;
  numeroSeguro: string | null;
  kilometragem: number | null;
  taraKg: number | null;
  capacidadeM3: number | null;
  veiculoProprio: boolean;
  nomeProprietario: string | null;
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
  rg: string | null;
  carteiraProfissional: string | null;
  nacionalidade: string | null;
  carteiraHabilitacao: string | null;
  validadeHabilitacao: string | null;
  emissaoHabilitacao: string | null;
  dataPrimeiraHabilitacao: string | null;
  celular: string | null;
  contato: string | null;
  email: string | null;
  tipoVinculo: 'motorista' | 'agregado' | 'chapa' | null;
  inicioVinculo: string | null;
}
