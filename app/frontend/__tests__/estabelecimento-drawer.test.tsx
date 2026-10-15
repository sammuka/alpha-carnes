import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EstabelecimentoDrawer } from '../src/components/fiscal/empresas/estabelecimento-drawer';

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
