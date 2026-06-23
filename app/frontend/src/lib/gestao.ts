// Tipos do domínio gestão (dashboard operacional).

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
  divergenciasAbertas: number;
  caminhoesDoDia: number;
  disponibilidade: {
    itens: number;
    itensEsgotados: number;
    quantidadeDisponivelTotal: string;
  };
}
