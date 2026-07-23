export interface ItemEstoqueConsulta {
  id: string;
  tipo: 'peca' | 'subitem';
  status: string;
  peso: string | null;
  quantidade: string;
  etiqueta: string | null;
  produto: {
    id: string | null;
    codigo: string;
    nome: string;
  };
  itemComercialId: string;
  createdAt: string;
}
