import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmpresaDialog } from '../src/components/fiscal/empresas/empresa-dialog';

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
