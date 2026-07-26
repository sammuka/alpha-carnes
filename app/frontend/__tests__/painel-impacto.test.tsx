import { render, screen } from '@testing-library/react';
import { PainelImpacto } from '../src/components/gestao/painel-impacto';
import type { ImpactoCompra } from '../src/lib/comercial';

const IMPACTO: ImpactoCompra = {
  compraId: 'c1',
  operacaoId: 'op-1',
  status: 'confirmada',
  deficitTotal: '3.000',
  exigeConfirmacao: true,
  resumo: '-3 TZ virtuais; déficit projetado: 3 TZ.',
  itens: [
    {
      itemComercialId: 'ic-1',
      codigo: 'TZ',
      descricao: 'Traseiro',
      quantidadeGeradaAtual: '80.000',
      quantidadeGeradaProjetada: '77.000',
      delta: '-3.000',
      quantidadeReservada: '80.000',
      saldoAtual: '0.000',
      saldoProjetado: '-3.000',
      deficitProjetado: '3.000',
    },
  ],
};

describe('PainelImpacto', () => {
  it('renderiza linha de déficit com texto do protótipo', () => {
    render(<PainelImpacto impacto={IMPACTO} />);
    expect(screen.getByText('Painel de impacto')).toBeInTheDocument();
    expect(screen.getByText(/Déficit resultante:/)).toBeInTheDocument();
    expect(screen.getByText(/overbooking\/risco no mapa/)).toBeInTheDocument();
    expect(screen.getByText(/Total de déficit projetado: 3.000/)).toBeInTheDocument();
  });

  it('não renderiza quando não há alteração', () => {
    const { container } = render(
      <PainelImpacto
        impacto={{
          ...IMPACTO,
          itens: [{ ...IMPACTO.itens[0]!, delta: '0.000', deficitProjetado: '0.000' }],
          deficitTotal: '0.000',
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
