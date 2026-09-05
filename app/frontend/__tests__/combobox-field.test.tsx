import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboboxField, type ComboboxItem } from '../src/components/ui/combobox-field';

const ITENS: ComboboxItem[] = [
  { id: 'r1', label: 'R01 — Norte', sublabel: 'Osasco' },
  { id: 'r2', label: 'R02 — Sul', sublabel: 'Barueri' },
];

function ComboboxControl({
  clearable = true,
  disabled = false,
  items = ITENS,
}: {
  clearable?: boolean;
  disabled?: boolean;
  items?: ComboboxItem[];
}) {
  const [value, setValue] = useState('');
  return (
    <ComboboxField
      items={items}
      value={value}
      onChange={setValue}
      placeholder="Selecione a rota"
      searchPlaceholder="Buscar rota"
      emptyText="Nenhuma rota encontrada"
      clearable={clearable}
      disabled={disabled}
    />
  );
}

describe('ComboboxField', () => {
  it('DoD 12.4 filtra por label e sublabel, seleciona por teclado e limpa opcional', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { rerender } = render(<ComboboxControl />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Selecione a rota');

    await user.click(trigger);
    const busca = await screen.findByPlaceholderText('Buscar rota');

    await user.type(busca, 'Norte');
    expect(screen.getByText('R01 — Norte')).toBeInTheDocument();
    expect(screen.queryByText('R02 — Sul')).not.toBeInTheDocument();

    await user.clear(busca);
    await user.type(busca, 'Barueri');
    expect(screen.getByText('R02 — Sul')).toBeInTheDocument();
    expect(screen.queryByText('R01 — Norte')).not.toBeInTheDocument();

    await user.clear(busca);
    await user.type(busca, 'Norte');
    await user.keyboard('{Enter}');
    expect(trigger).toHaveTextContent('R01 — Norte');

    const limpar = screen.getByRole('button', { name: 'Limpar seleção' });
    await user.click(limpar);
    expect(trigger).toHaveTextContent('Selecione a rota');
    expect(screen.queryByRole('button', { name: 'Limpar seleção' })).not.toBeInTheDocument();

    await user.click(trigger);
    await user.type(await screen.findByPlaceholderText('Buscar rota'), 'xyz-inexistente');
    expect(screen.getByText('Nenhuma rota encontrada')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText('Buscar rota')).not.toBeInTheDocument();
    rerender(<ComboboxControl disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Limpar seleção' })).not.toBeInTheDocument();
    expect(within(document.body).queryByPlaceholderText('Buscar rota')).not.toBeInTheDocument();
  });
});
