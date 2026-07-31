import { render, screen } from '@testing-library/react';
import { QuadroComparativo } from '../src/components/gestao/quadro-comparativo';

const ITENS = [
  {
    itemComercialId: 'ic-1',
    codigo: 'TZ',
    descricao: 'Traseiro',
    qtdPedido: '10',
    qtdNf: '10',
    qtdApurada: '9',
    pesoNf: '500.000',
    pesoApurado: '495.000',
    difQtd: '-1',
    difPeso: '-5.000',
  },
  {
    itemComercialId: 'ic-2',
    codigo: 'DT',
    descricao: 'Dianteiro',
    qtdPedido: '5',
    qtdNf: '5',
    qtdApurada: '5',
    pesoNf: '200.000',
    pesoApurado: '200.000',
    difQtd: '0',
    difPeso: '0',
  },
];

describe('QuadroComparativo', () => {
  it('renderiza as 8 colunas e destaca linha divergente', () => {
    render(<QuadroComparativo itens={ITENS} />);
    expect(screen.getByText('Produto')).toBeInTheDocument();
    expect(screen.getByText('Pedido: qtd.')).toBeInTheDocument();
    expect(screen.getByText('Dif. peso')).toBeInTheDocument();
    expect(screen.getByText('TZ')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('exibe aviso de imutabilidade do protótipo', () => {
    render(<QuadroComparativo itens={ITENS} />);
    expect(
      screen.getByText(/Os totais históricos da pesagem não são alterados pela tratativa/),
    ).toBeInTheDocument();
    expect(screen.getByText(/imutáveis e servem apenas de referência/)).toBeInTheDocument();
  });
});
