import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EstabelecimentoDrawer } from '../src/components/fiscal/empresas/estabelecimento-drawer';

jest.mock('../src/lib/fiscal-empresas', () => {
  const real = jest.requireActual('../src/lib/fiscal-empresas');
  return { ...real, fiscalApi: { ...real.fiscalApi, atualizarEstabelecimento: jest.fn() } };
});

const EMPRESA = { id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', razaoSocial: 'Alpha Carnes Ltda', cnpjRaiz: '12345678', versao: 1 };

async function verificar(cnpj: string) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <EstabelecimentoDrawer
      aberto
      onFechar={() => undefined}
      empresas={[EMPRESA]}
      empresaInicialId={EMPRESA.id}
      onEmpresaCriada={() => undefined}
      onSalvo={() => undefined}
      onConflito={() => undefined}
    />,
  );
  await user.type(await screen.findByLabelText(/CNPJ/), cnpj);
  await user.click(screen.getByRole('button', { name: 'Verificar dados' }));
}

describe('EstabelecimentoDrawer · Verificar dados', () => {
  it('recusa CNPJ com dígito verificador errado', async () => {
    await verificar('12345678000100');
    expect(await screen.findByText('CNPJ inválido: confira os dígitos verificadores.')).toBeInTheDocument();
  });

  it('aceita CNPJ com dígito verificador correto', async () => {
    await verificar('12345678000195');
    expect(screen.queryByText(/CNPJ inválido/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CNPJ deve ter/)).not.toBeInTheDocument();
  });
});

describe('EstabelecimentoDrawer · Cancelar durante o envio', () => {
  it('fica desabilitado enquanto o rascunho está sendo gravado', async () => {
    const { fiscalApi } = jest.requireMock('../src/lib/fiscal-empresas') as { fiscalApi: { atualizarEstabelecimento: jest.Mock } };
    let concluir: (valor: unknown) => void = () => undefined;
    fiscalApi.atualizarEstabelecimento.mockReturnValue(new Promise((resolver) => { concluir = resolver; }));
    const atual = {
      id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61', empresaId: EMPRESA.id, nome: 'Matriz Osasco', cnpj: '12345678000195',
      inscricaoEstadual: '111.222.333.444', inscricaoMunicipal: '998877', uf: 'SP', municipioIbgeCodigo: null,
      situacao: 'DRAFT', versao: 4, justificativaSituacao: null, empresa: EMPRESA,
      cnaes: [{ codigo: '4722901', descricao: 'Comércio varejista de carnes', tipo: 'PRINCIPAL' }],
      regimes: [], alteracaoAberta: null, responsavel: { nome: 'Maria Souza' },
    };
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <EstabelecimentoDrawer
        aberto
        onFechar={() => undefined}
        empresas={[EMPRESA]}
        estabelecimento={atual as never}
        onEmpresaCriada={() => undefined}
        onSalvo={() => undefined}
        onConflito={() => undefined}
      />,
    );
    const cancelar = await screen.findByRole('button', { name: 'Cancelar' });
    expect(cancelar).toBeEnabled();
    await user.clear(screen.getByLabelText(/^Estabelecimento/));
    await user.type(screen.getByLabelText(/^Estabelecimento/), 'Matriz Osasco II');
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Novo nome.');
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(cancelar).toBeDisabled());
    concluir(atual);
    await waitFor(() => expect(cancelar).toBeEnabled());
  });
});
