// Função pura que avalia bloqueios críticos para emissão (RF-FT-09)
export interface Bloqueio {
  codigo: string;
  causa: string;
  impacto: string;
  acao: string;
}

export interface DadosParaBloqueios {
  statusCaminhao: string;
  itensCarregados: Array<{
    pedidoVendaId: string;
    cliente: { razaoSocial: string; documentoFiscal: string; dadosFiscaisJson: Record<string, unknown> };
  }>;
  // Divergências críticas não tratadas (buscadas do banco)
  temDivergenciaCriticaNaoTratada: boolean;
  // Peças sem rastreabilidade (sem pedido associado)
  temPecaSemRastreabilidade: boolean;
}

export function avaliarBloqueios(dados: DadosParaBloqueios): Bloqueio[] {
  const bloqueios: Bloqueio[] = [];

  if (dados.statusCaminhao !== 'fechado') {
    bloqueios.push({
      codigo: 'EXPEDICAO_NAO_FECHADA',
      causa: `Expedição com status '${dados.statusCaminhao}' em vez de 'fechado'`,
      impacto: 'Não é possível faturar carga em aberto',
      acao: 'Feche a expedição antes de faturar',
    });
  }

  if (dados.temDivergenciaCriticaNaoTratada) {
    bloqueios.push({
      codigo: 'DIVERGENCIA_CRITICA_NAO_TRATADA',
      causa: 'Há divergência crítica de recebimento não resolvida',
      impacto: 'Faturamento com divergência não documentada é irregular',
      acao: 'Resolva as divergências críticas antes de faturar',
    });
  }

  // Verificar dados fiscais do cliente
  for (const item of dados.itensCarregados) {
    const doc = item.cliente.documentoFiscal;
    if (!doc || doc.replace(/\D/g, '').length < 11) {
      bloqueios.push({
        codigo: 'DADOS_FISCAIS_INCOMPLETOS',
        causa: `Cliente não possui documento fiscal válido (CNPJ/CPF)`,
        impacto: 'NFS-e exige documento fiscal do tomador',
        acao: `Complete os dados fiscais do cliente no cadastro`,
      });
      break; // um bloqueio por tipo é suficiente para o grupo
    }
  }

  if (dados.temPecaSemRastreabilidade) {
    bloqueios.push({
      codigo: 'PECA_SEM_RASTREABILIDADE',
      causa: 'Há peça(s) na carga sem pedido associado',
      impacto: 'Rastreabilidade NF↔pedido↔peça não pode ser garantida',
      acao: 'Associe todas as peças a pedidos antes de faturar',
    });
  }

  return bloqueios;
}
