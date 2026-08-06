import { render, screen } from '@testing-library/react';
import { Kpi, KpiStrip } from '../kpi-strip';

describe('KpiStrip', () => {
  it('renderiza label, valor e hint', () => {
    render(
      <KpiStrip>
        <Kpi label="Overbookings abertos" value={2} hint="aguardando decisão" tone="alert" />
      </KpiStrip>,
    );
    expect(screen.getByText('Overbookings abertos')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('aguardando decisão')).toBeInTheDocument();
  });

  it('aplica tom de alerta no valor', () => {
    render(
      <KpiStrip>
        <Kpi label="X" value={1} tone="danger" />
      </KpiStrip>,
    );
    expect(screen.getByText('1')).toHaveClass('text-danger-fg');
  });
});
