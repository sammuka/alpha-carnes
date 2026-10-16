import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmpresaDialog } from '../src/components/fiscal/empresas/empresa-dialog';
import { RegimeDialog } from '../src/components/fiscal/empresas/regime-dialog';
import { DecisaoDialog } from '../src/components/fiscal/empresas/decisao-dialog';
import { EnquadramentoDrawer } from '../src/components/fiscal/enquadramentos/enquadramento-drawer';
import { ErroFiscal, type RegimeVersao } from '../src/lib/fiscal-empresas';
import type { DetalheEnquadramento } from '../src/lib/fiscal-enquadramentos';

describe('EmpresaDialog com envio em voo', () => {
  it('reenvios e Escape durante o POST não duplicam nem fecham', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    let liberar: (r: Response) => void = () => undefined;
    const posts = jest.fn();
    global.fetch = jest.fn(async () => {
      posts();
      return new Promise<Response>((resolve) => { liberar = resolve; });
    }) as unknown as typeof fetch;
    const onFechar = jest.fn();
    render(<EmpresaDialog aberto onFechar={onFechar} onSalvo={() => undefined} />);
    await user.type(screen.getByLabelText(/Razão social/), 'Alpha Carnes Ltda');
    await user.type(screen.getByLabelText(/CNPJ raiz/), '12345678');
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Cadastro inicial');
    const salvar = screen.getByRole('button', { name: /Salvar|Cadastrar|Criar/ });
    await user.click(salvar);
    await user.click(salvar);
    fireEvent.submit(salvar.closest('form')!);
    fireEvent.submit(salvar.closest('form')!);
    await user.keyboard('{Escape}');
    expect(posts).toHaveBeenCalledTimes(1);
    expect(onFechar).not.toHaveBeenCalled();
    await act(async () => {
      liberar(new Response(JSON.stringify({ id: 'x', razaoSocial: 'Alpha Carnes Ltda', cnpjRaiz: '12345678', versao: 1 }), { status: 201 }));
    });
    await waitFor(() => expect(onFechar).toHaveBeenCalledTimes(1));
    expect(posts).toHaveBeenCalledTimes(1);
  });
});

const pendente = () => {
  global.fetch = jest.fn(() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;
};

describe('Cancelar com envio em voo', () => {
  it('EmpresaDialog: Cancelar desabilitado', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    pendente();
    const onFechar = jest.fn();
    render(<EmpresaDialog aberto onFechar={onFechar} onSalvo={() => undefined} />);
    await user.type(screen.getByLabelText(/Razão social/), 'Alpha Carnes Ltda');
    await user.type(screen.getByLabelText(/CNPJ raiz/), '12345678');
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Cadastro inicial');
    await user.click(screen.getByRole('button', { name: /Cadastrar empresa/ }));
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    await user.click(cancelar);
    expect(cancelar).toBeDisabled();
    expect(onFechar).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('RegimeDialog: Cancelar desabilitado', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    pendente();
    const onFechar = jest.fn();
    const regime = { id: 'r1', crt: '1', vigenciaInicio: '2026-01-01', vigenciaFim: null, versao: 1 } as unknown as RegimeVersao;
    render(
      <RegimeDialog aberto onFechar={onFechar} estabelecimentoId="e1" nomeEstabelecimento="Matriz" regime={regime} onSalvo={() => undefined} onConflito={() => undefined} />,
    );
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Ajuste de vigência');
    await user.click(screen.getByRole('button', { name: /Salvar rascunho/ }));
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    await user.click(cancelar);
    expect(cancelar).toBeDisabled();
    expect(onFechar).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('EnquadramentoDrawer: Cancelar desabilitado', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onFechar = jest.fn();
    const onSalvar = jest.fn(() => new Promise<string | null>(() => undefined));
    const detalhe = {
      id: 'q1', versao: 1, estabelecimentoId: 'e1', operacaoId: 'o1', tpNf: '1', finNfe: '1', cfopId: 'c1',
      cfopCodigo: '5102', cfopDescricao: 'Venda', abrangencia: 'INTERNA', tipoProduto: 'REVENDA', produtoId: 'p1',
      produtoNome: 'Picanha', ncmId: 'n1', ncmCodigo: '02023000', ncmDescricao: 'Carne', cest: '1700100',
      clienteId: 'cl1', clienteNome: 'Cliente', vigenciaInicio: '2026-01-01', vigenciaFim: null, prioridade: 1,
    } as unknown as DetalheEnquadramento;
    render(
      <EnquadramentoDrawer aberto detalhe={detalhe} erro={null} onFechar={onFechar} onSalvar={onSalvar} onErro={() => undefined} onNovoCodigo={() => undefined} />,
    );
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Ajuste de prioridade');
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(onSalvar).toHaveBeenCalledTimes(1);
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    await user.click(cancelar);
    expect(cancelar).toBeDisabled();
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('DecisaoDialog: AlertDialog de troca não fecha em voo', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const executar = jest
      .fn()
      .mockRejectedValueOnce(new ErroFiscal('Confirme', 409, 'TROCA_REGIME_CONFIRMACAO_NECESSARIA', { fimProposto: '2026-01-31' }, {}))
      .mockImplementationOnce(() => new Promise(() => undefined));
    const decisao = { titulo: 'Submeter', detalhe: 'd', rotuloConfirmar: 'Submeter regime', mensagemSucesso: 'ok', executar };
    render(<DecisaoDialog decisao={decisao} onFechar={() => undefined} onConcluido={() => undefined} onConflito={() => undefined} />);
    await user.type(screen.getByLabelText(/Justificativa/), 'Troca de regime');
    await user.click(screen.getByRole('button', { name: 'Submeter regime' }));
    const alerta = await screen.findByRole('alertdialog');
    await user.click(within(alerta).getByRole('button', { name: 'Encerrar e submeter' }));
    expect(executar).toHaveBeenCalledTimes(2);
    const cancelar = within(alerta).getByRole('button', { name: 'Cancelar' });
    await user.click(cancelar);
    await user.keyboard('{Escape}');
    expect(cancelar).toBeDisabled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
