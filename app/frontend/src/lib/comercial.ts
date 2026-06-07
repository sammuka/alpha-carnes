// Tipos compartilhados do domínio comercial (F3) no frontend.

export interface DisponibilidadeDia {
  id: string;
  itemComercialId: string;
  dataOperacao: string;
  quantidadeTotalGerada: string;
  quantidadeReservada: string;
  quantidadeDisponivel: string;
  quantidadeRecebida: string;
  quantidadeComDivergencia: string;
  status: string;
}

export interface ResultadoPedido {
  id: string;
  status: string;
}
