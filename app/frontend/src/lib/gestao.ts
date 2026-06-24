// Tipos do domínio gestão (dashboard operacional).

export interface PedidoEmAndamento {
  pedidoId: string;
  clienteNome: string;
  produtoResumo: string;
  pesoTotalKg: string | null;
  status: string;
  dataOperacao: string;
}

export interface AtividadeRecente {
  id: string;
  usuarioNome: string;
  descricao: string;
  createdAt: string;
}

export interface DashboardDia {
  dataOperacao: string;
  comprasProgramadas: {
    total: number;
    porStatus: Record<string, number>;
    compraAtiva: { id: string; status: string } | null;
  };
  pedidos: {
    total: number;
    porStatus: Record<string, number>;
  };
  pedidosEmAndamento: PedidoEmAndamento[];
  atividadesRecentes: AtividadeRecente[];
  divergenciasAbertas: number;
  caminhoesDoDia: number;
  disponibilidade: {
    itens: number;
    itensEsgotados: number;
    quantidadeDisponivelTotal: string;
  };
}
