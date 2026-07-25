import { render, screen } from '@testing-library/react';
import { Scale } from 'lucide-react';
import { KpiCard } from '../src/components/ui/kpi-card';

describe('KpiCard', () => {
  it('renderiza rotulo, valor, tendencia e variante por token', () => {
    render(
      <KpiCard label="Peças pesadas" value="1.284" trend="+12%" sub="vs. operação anterior" variant="violet" Icon={Scale} />,
    );
    expect(screen.getByText('Peças pesadas')).toBeInTheDocument();
    expect(screen.getByText('1.284')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toHaveStyle({ color: 'var(--color-status-expedido)' });
    expect(screen.getByText('vs. operação anterior')).toBeInTheDocument();
  });

  it('tendencia negativa usa o token de bloqueio', () => {
    render(<KpiCard label="Divergências" value={3} trend="-4%" trendPositive={false} Icon={Scale} />);
    expect(screen.getByText('-4%')).toHaveStyle({ color: 'var(--color-status-bloqueado)' });
  });

  it('sem tendencia exibe apenas o subtexto', () => {
    render(<KpiCard label="Cargas" value={7} sub="em conferência" Icon={Scale} />);
    expect(screen.getByText('em conferência')).toBeInTheDocument();
  });
});
