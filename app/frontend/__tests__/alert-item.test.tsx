import { render, screen } from '@testing-library/react';
import { AlertTriangle } from 'lucide-react';
import { AlertItem } from '../src/components/ui/alert-item';

describe('AlertItem', () => {
  it('renderiza titulo, descricao, hora e o dot de status', () => {
    const { container } = render(
      <AlertItem
        title="Divergência no recebimento"
        description="Pedido ao fornecedor PF-0031 com falta de 2 peças."
        time="09:42"
        variant="divergencia"
        Icon={AlertTriangle}
      />,
    );
    expect(screen.getByText('Divergência no recebimento')).toBeInTheDocument();
    expect(screen.getByText('Pedido ao fornecedor PF-0031 com falta de 2 peças.')).toBeInTheDocument();
    expect(screen.getByText('09:42')).toBeInTheDocument();
    expect(container.querySelector('.bg-status-divergencia-dot')).not.toBeNull();
  });

  it('usa a variante pendente por padrao', () => {
    const { container } = render(<AlertItem title="Aguardando" description="Sem ação." time="10:00" />);
    expect(container.querySelector('.bg-status-pendente-dot')).not.toBeNull();
  });
});
