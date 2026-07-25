import { render, screen } from '@testing-library/react';
import { StatusPill, type StatusPillVariant } from '../src/components/ui/status-pill';

const CASOS: [StatusPillVariant, string][] = [
  ['recebido', 'Recebido'],
  ['pesado', 'Pesado'],
  ['expedido', 'Expedido'],
  ['divergencia', 'Divergência'],
  ['bloqueado', 'Bloqueado'],
  ['pendente', 'Pendente'],
];

describe('StatusPill', () => {
  it.each(CASOS)('renderiza as 6 variantes com rotulo canonico e cor por token: %s', (variant, rotulo) => {
    const { container } = render(<StatusPill variant={variant} />);
    expect(screen.getByText(rotulo)).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({
      color: `var(--color-status-${variant})`,
      backgroundColor: `var(--color-status-${variant}-bg)`,
    });
  });

  it('aceita rotulo customizado', () => {
    render(<StatusPill variant="pendente" label="Aguardando conferência" />);
    expect(screen.getByText('Aguardando conferência')).toBeInTheDocument();
  });
});
