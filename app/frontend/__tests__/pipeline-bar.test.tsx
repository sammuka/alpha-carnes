import { render, screen } from '@testing-library/react';
import { PipelineBar, ETAPAS_PIPELINE } from '../src/components/ui/pipeline-bar';

describe('PipelineBar', () => {
  it('lista as 4 etapas do prototipo na ordem canonica', () => {
    expect(ETAPAS_PIPELINE).toEqual([
      'Recebimento',
      'Conferência & Destinação',
      'Carga',
      'Faturamento',
    ]);
  });

  it('marca etapa concluida, atual e futura conforme o prototipo', () => {
    render(<PipelineBar etapaAtual="Carga" />);
    expect(screen.getByText('Recebimento').closest('[data-estado]')).toHaveAttribute('data-estado', 'concluida');
    expect(screen.getByText('Carga').closest('[data-estado]')).toHaveAttribute('data-estado', 'atual');
    expect(screen.getByText('Faturamento').closest('[data-estado]')).toHaveAttribute('data-estado', 'futura');
    expect(screen.getByRole('list')).toHaveAccessibleName('Etapas da operação');
  });

  it('exibe contadores por etapa quando informados', () => {
    render(<PipelineBar etapaAtual="Recebimento" contadores={{ recebimento: '12', carga: '7' }} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('marca a etapa atual para leitores de tela', () => {
    render(<PipelineBar etapaAtual="Faturamento" />);
    expect(screen.getByText('Faturamento').closest('li')).toHaveAttribute('aria-current', 'step');
  });
});
