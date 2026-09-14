import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TrocaPecaModal,
  TrocaPecaFluxo,
  PASSOS_TROCA_PECA,
} from '../src/components/ui/troca-peca-modal';
import { ROTULOS_MOTIVO_TROCA_PECA } from '../src/lib/operacao';

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

describe('TrocaPecaFluxo (6.28)', () => {
  const pedidos = [
    {
      pedidoVendaId: 'pv1aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      pedidoVendaItemId: 'pvi1aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      clienteNome: 'Restaurante Grill',
      produtoLabel: 'TZ — Traseiro',
      produtoCodigo: 'TZ',
      quantidadeJaVinculada: 1,
      quantidadeTotalAVincular: 1,
      pecasAssociadas: [{ id: 'pr1aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', codigo: 'TZ-000341', peso: '48.750', produtoCodigo: 'TZ' }],
    },
    {
      pedidoVendaId: 'pv2aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      pedidoVendaItemId: 'pvi2aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      clienteNome: 'Cliente Entrada',
      produtoLabel: 'TZ — Traseiro',
      produtoCodigo: 'TZ',
      quantidadeJaVinculada: 1,
      quantidadeTotalAVincular: 3,
      pecasAssociadas: [],
    },
    {
      pedidoVendaId: 'pv3aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      pedidoVendaItemId: 'pvi3aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      clienteNome: 'Outro Cliente',
      produtoLabel: 'TZ — Traseiro',
      produtoCodigo: 'TZ',
      quantidadeJaVinculada: 0,
      quantidadeTotalAVincular: 2,
      pecasAssociadas: [],
    },
  ];
  const pecasDisponiveis = [
    { id: 'pi1aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', codigo: 'TZ-000362', peso: '47.980', produtoCodigo: 'TZ', clienteNome: 'Cliente Entrada' },
  ];

  it('confirma a troca em um único passo com substituição', async () => {
    const user = userEvent.setup();
    const onTrocaConcluida = jest.fn();
    const pecaRet = pedidos[0]!.pecasAssociadas[0]!;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        id: pecaRet.id,
        statusPeca: 'associada',
        pedidoVendaItemId: pedidos[1]!.pedidoVendaItemId,
      }),
    })) as unknown as typeof fetch;

    render(
      <TrocaPecaFluxo
        open
        onFechar={jest.fn()}
        onTrocaConcluida={onTrocaConcluida}
        pedidos={pedidos}
        pecasDisponiveis={pecasDisponiveis}
      />,
    );

    await user.click(screen.getByText('Restaurante Grill'));
    await user.click(screen.getByText(/TZ-000341/));
    await user.click(screen.getByText('Cliente Entrada'));
    await user.selectOptions(screen.getByLabelText('Motivo da troca'), 'peca_mais_adequada');
    await user.click(screen.getByRole('button', { name: 'Confirmar Troca e gerar nova etiqueta' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      `/api/operacao/pesagem/pecas/${pecaRet.id}/redirecionar`,
      expect.objectContaining({ method: 'POST' }),
    ));
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      pedidoVendaItemId: string;
    };
    expect(body.pedidoVendaItemId).toBe(pedidos[1]!.pedidoVendaItemId);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      `/api/operacao/pesagem/pecas/${pecaRet.id}/etiqueta`,
      expect.objectContaining({ method: 'POST' }),
    ));
    await waitFor(() => expect(screen.getByText('Peça vinculada ao pedido de destino. Nova etiqueta gerada.')).toBeInTheDocument());
    expect(onTrocaConcluida).toHaveBeenCalled();
  });

  it('usa abas de tipo de peça e exige motivo; destino da retirada só sem substituição', async () => {
    const user = userEvent.setup();
    render(
      <TrocaPecaFluxo
        open
        onFechar={jest.fn()}
        pedidos={pedidos}
        pecasDisponiveis={pecasDisponiveis}
      />,
    );
    expect(screen.queryByRole('combobox', { name: 'Tipo da peça' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /TZ/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Pedidos de origem')).toHaveTextContent('Restaurante Grill');
    expect(screen.getByLabelText('Pedidos de origem')).toHaveTextContent('1/1');
    expect(screen.getByLabelText('Pedidos de origem')).not.toHaveTextContent('TZ — Traseiro');
    expect(screen.getByLabelText('Pedidos de origem')).not.toHaveTextContent('48,750 kg');
    await user.click(screen.getByText('Restaurante Grill'));
    expect(screen.getByLabelText('Peças vinculadas')).toHaveTextContent('48,750 kg');
    expect(screen.queryByLabelText('Destino da peça retirada')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Motivo da troca')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Necessita substituição'));
    expect(screen.getByLabelText('Destino da peça retirada')).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo da troca')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pedidos de destino')).not.toBeInTheDocument();
  });

  it('filtra o destino da troca pelo cliente', async () => {
    const user = userEvent.setup();
    render(
      <TrocaPecaFluxo
        open
        onFechar={jest.fn()}
        pedidos={pedidos}
        pecasDisponiveis={pecasDisponiveis}
      />,
    );
    expect(screen.getByLabelText('Pedidos de destino')).toHaveTextContent('Cliente Entrada');
    expect(screen.getByLabelText('Pedidos de destino')).toHaveTextContent('Outro Cliente');
    expect(screen.getByLabelText('Pedidos de destino')).not.toHaveTextContent('Restaurante Grill');
    expect(screen.queryByText(/TZ-000362/)).not.toBeInTheDocument();
    await user.type(screen.getAllByPlaceholderText('Nome do cliente')[1]!, 'Cliente Entrada');
    expect(screen.getByLabelText('Pedidos de destino')).toHaveTextContent('Cliente Entrada');
    expect(screen.getByLabelText('Pedidos de destino')).not.toHaveTextContent('Outro Cliente');
  });

  it('separa origem completa de destino incompleto sem misturar peça no pedido', () => {
    render(
      <TrocaPecaFluxo
        open
        onFechar={jest.fn()}
        pedidos={pedidos}
        pecasDisponiveis={pecasDisponiveis}
      />,
    );
    expect(screen.getByLabelText('Pedidos de origem')).toHaveTextContent('Restaurante Grill');
    expect(screen.getByLabelText('Pedidos de origem')).not.toHaveTextContent('Cliente Entrada');
    expect(screen.getByLabelText('Pedidos de destino')).toHaveTextContent('1/3');
    expect(screen.getByLabelText('Pedidos de destino')).toHaveTextContent('0/2');
    expect(screen.queryByText(/TZ-000341/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Peças vinculadas')).toHaveTextContent('Selecione um pedido');
  });

  it('agrupa dois itens 1/1 do mesmo pedido como 2/2 em uma linha', () => {
    const mesmos: typeof pedidos = [
      {
        ...pedidos[0]!,
        pedidoVendaItemId: 'pvi-a-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        quantidadeJaVinculada: 1,
        quantidadeTotalAVincular: 1,
      },
      {
        ...pedidos[0]!,
        pedidoVendaItemId: 'pvi-b-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        quantidadeJaVinculada: 1,
        quantidadeTotalAVincular: 1,
        pecasAssociadas: [{ id: 'pr2aaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', codigo: 'TZ-000342', peso: '47.000', produtoCodigo: 'TZ' }],
      },
    ];
    render(
      <TrocaPecaFluxo open onFechar={jest.fn()} pedidos={mesmos} pecasDisponiveis={[]} />,
    );
    const origem = screen.getByLabelText('Pedidos de origem');
    expect(origem).toHaveTextContent('Restaurante Grill');
    expect(origem).toHaveTextContent('2/2');
    expect(origem.querySelectorAll('button')).toHaveLength(1);
    expect(origem.textContent).not.toMatch(/1\/1/);
  });

  it('destina a peça da origem ao estoque quando não há substituição', async () => {
    const user = userEvent.setup();
    const pecaRet = pedidos[0]!.pecasAssociadas[0]!;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ id: pecaRet.id, statusPeca: 'em_sobra', pedidoVendaItemId: null }),
    })) as unknown as typeof fetch;

    render(
      <TrocaPecaFluxo
        open
        onFechar={jest.fn()}
        onTrocaConcluida={jest.fn()}
        pedidos={pedidos}
        pecasDisponiveis={pecasDisponiveis}
      />,
    );

    await user.click(screen.getByText('Restaurante Grill'));
    await user.click(screen.getByText(/TZ-000341/));
    await user.click(screen.getByLabelText('Necessita substituição'));
    await user.selectOptions(screen.getByLabelText('Destino da peça retirada'), 'desossa');
    await user.selectOptions(screen.getByLabelText('Motivo da troca'), 'peca_mais_adequada');
    await user.click(screen.getByRole('button', { name: 'Confirmar Troca e gerar nova etiqueta' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      `/api/operacao/pesagem/pecas/${pecaRet.id}/destinar-retirada`,
      expect.objectContaining({ method: 'POST' }),
    ));
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string) as {
      destino: string;
    };
    expect(body.destino).toBe('desossa');
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      `/api/operacao/pesagem/pecas/${pecaRet.id}/etiqueta`,
      expect.objectContaining({ method: 'POST' }),
    ));
    await waitFor(() => expect(screen.getByText('Peça destinada à desossa. Nova etiqueta gerada.')).toBeInTheDocument());
  });

  it('cancela sem enviar POST', async () => {
    const user = userEvent.setup();
    const onFechar = jest.fn();
    global.fetch = jest.fn();
    render(
      <TrocaPecaFluxo
        open
        onFechar={onFechar}
        pedidos={pedidos}
        pecasDisponiveis={pecasDisponiveis}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onFechar).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
