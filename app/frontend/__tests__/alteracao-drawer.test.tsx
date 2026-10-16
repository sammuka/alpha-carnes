import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlteracaoDrawer } from '../src/components/fiscal/empresas/alteracao-drawer';
import { fiscalApi, type EstabelecimentoDetalhe } from '../src/lib/fiscal-empresas';

jest.mock('../src/lib/fiscal-empresas', () => {
  const real = jest.requireActual('../src/lib/fiscal-empresas');
  return { ...real, fiscalApi: { ...real.fiscalApi, atualizarAlteracao: jest.fn() } };
});

const CNAES = [{ codigo: '4722901', descricao: 'Comércio varejista de carnes', tipo: 'PRINCIPAL' as const }];
const PROPOSTA = {
  id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a81',
  nome: 'Matriz Osasco',
  inscricaoEstadual: '111.222.333.444',
  inscricaoMunicipal: '998877',
  uf: 'SP',
  situacao: 'DRAFT' as const,
  versao: 2,
  versaoBase: 4,
  cnaes: CNAES,
};
const ESTABELECIMENTO = {
  id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a61',
  empresaId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
  nome: 'Matriz Osasco',
  cnpj: '12345678000195',
  inscricaoEstadual: '111.222.333.444',
  inscricaoMunicipal: '998877',
  uf: 'SP',
  municipioIbgeCodigo: null,
  situacao: 'APPROVED',
  versao: 4,
  justificativaSituacao: null,
  empresa: null,
  cnaes: CNAES,
  regimes: [],
  alteracaoAberta: PROPOSTA,
  responsavel: { nome: 'Maria Souza' },
} as EstabelecimentoDetalhe;

describe('AlteracaoDrawer · Cancelar durante o envio', () => {
  it('fica desabilitado enquanto a proposta está sendo gravada', async () => {
    let concluir: (valor: typeof PROPOSTA) => void = () => undefined;
    (fiscalApi.atualizarAlteracao as jest.Mock).mockReturnValue(new Promise((resolver) => { concluir = resolver; }));
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <AlteracaoDrawer aberto onFechar={() => undefined} estabelecimento={ESTABELECIMENTO} onSalvo={() => undefined} onConflito={() => undefined} />,
    );
    const cancelar = await screen.findByRole('button', { name: 'Cancelar' });
    expect(cancelar).toBeEnabled();
    await user.type(screen.getByLabelText(/Motivo da alteração/), 'Ajuste da inscrição.');
    await user.click(screen.getByRole('button', { name: 'Salvar proposta' }));
    await waitFor(() => expect(cancelar).toBeDisabled());
    concluir(PROPOSTA);
    await waitFor(() => expect(cancelar).toBeEnabled());
  });
});
