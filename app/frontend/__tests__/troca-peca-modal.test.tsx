import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrocaPecaModal, PASSOS_TROCA_PECA } from '../src/components/ui/troca-peca-modal';

describe('TrocaPecaModal (base visual)', () => {
  it('lista os 6 passos do prototipo', () => {
    expect(PASSOS_TROCA_PECA).toEqual([
      'Selecionar pedido',
      'Peça atual associada',
      'Nova peça',
      'Destino da peça retirada',
      'Motivo da troca',
      'Revisão de impactos',
    ]);
  });

  it('renderiza o chrome do wizard de 6 passos com o titulo do passo', () => {
    render(
      <TrocaPecaModal open passo={3} podeAvancar onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={jest.fn()} onConfirmar={jest.fn()}>
        <p>conteúdo do passo</p>
      </TrocaPecaModal>,
    );
    expect(screen.getByRole('dialog', { name: 'Trocar Peça' })).toBeInTheDocument();
    expect(screen.getByText('Passo 3 de 6 · Nova peça')).toBeInTheDocument();
    expect(screen.getByText('conteúdo do passo')).toBeInTheDocument();
  });

  it('desabilita Voltar no passo 1 e mostra Confirmar Troca no passo 6', () => {
    const { rerender } = render(
      <TrocaPecaModal open passo={1} podeAvancar={false} onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={jest.fn()} onConfirmar={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Voltar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Avançar/ })).toBeDisabled();

    rerender(
      <TrocaPecaModal open passo={6} podeAvancar onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={jest.fn()} onConfirmar={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Confirmar Troca' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Avançar/ })).not.toBeInTheDocument();
  });

  it('nao decide transicao de passo por conta propria', async () => {
    const onAvancar = jest.fn();
    render(
      <TrocaPecaModal open passo={2} podeAvancar onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={onAvancar} onConfirmar={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    expect(onAvancar).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Passo 2 de 6 · Peça atual associada')).toBeInTheDocument();
  });

  it('renderiza o painel de sucesso com nova etiqueta e historico', () => {
    render(
      <TrocaPecaModal
        open
        passo={6}
        podeAvancar
        onFechar={jest.fn()}
        onVoltar={jest.fn()}
        onAvancar={jest.fn()}
        onConfirmar={jest.fn()}
        resultado={{
          novaEtiqueta: 'ETQ-88412',
          etiquetaInvalidada: 'ETQ-88391',
          usuario: 'Richard',
          dataHora: '25/07/2026 09:42',
          motivo: 'Peça mais adequada ao cliente',
        }}
      />,
    );
    expect(screen.getByText('Troca realizada com sucesso')).toBeInTheDocument();
    expect(screen.getByText('ETQ-88412')).toBeInTheDocument();
    expect(screen.getByText('ETQ-88391')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument();
  });

  it('nao renderiza nada quando fechado', () => {
    render(<TrocaPecaModal open={false} passo={1} podeAvancar={false} onFechar={jest.fn()} onVoltar={jest.fn()} onAvancar={jest.fn()} onConfirmar={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
