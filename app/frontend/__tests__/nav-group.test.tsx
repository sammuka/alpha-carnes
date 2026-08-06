import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayoutDashboard } from 'lucide-react';
import { NavGroup } from '../src/components/ui/nav-group';

const mockPathname = jest.fn(() => '/comercial/clientes');

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const itens = [
  { href: '/gestao/dashboard', label: 'Painel Geral da Operação', Icon: LayoutDashboard },
  { href: '/gestao/compras', label: 'Compras', Icon: LayoutDashboard },
];

/**
 * O colapso do protótipo mantém os itens montados e anima `max-height` (220ms) com
 * `overflow-hidden`. `toBeVisible()` do jest-dom não olha `max-height` e o Tailwind não
 * compila no jsdom: um link dentro do painel fechado passaria em `toBeVisible()`. Por isso
 * o teste afere o mecanismo real — `aria-expanded`, `data-state` e a `max-height` inline —,
 * que fica vermelho se o colapso desaparecer. O componente emite unidade (`'0px'` /
 * `` `${alturaItens}px` ``): React serializa `maxHeight: 0` (número) como `"0"` no jsdom,
 * e `.toBe('0px')` / `toHaveStyle({ maxHeight: '0px' })` falhariam.
 */
function painelDe(cabecalho: HTMLElement): HTMLElement {
  const id = cabecalho.getAttribute('aria-controls');
  const painel = id ? document.getElementById(id) : null;
  if (!painel) throw new Error('cabeçalho do grupo não aponta para o painel de itens via aria-controls');
  return painel;
}

describe('NavGroup', () => {
  it('colapsa e expande o grupo ao clicar no cabecalho', async () => {
    mockPathname.mockReturnValue('/comercial/clientes');
    render(<NavGroup title="GESTÃO" items={itens} defaultOpen />);

    const cabecalho = screen.getByRole('button', { name: /GESTÃO/ });
    const painel = painelDe(cabecalho);
    expect(cabecalho).toHaveAttribute('aria-expanded', 'true');
    expect(painel).toHaveAttribute('data-state', 'aberto');
    // 2 itens × 32px + 4px, conforme alturaItens do componente
    expect(painel.style.maxHeight).toBe('68px');

    await userEvent.click(cabecalho);
    expect(cabecalho).toHaveAttribute('aria-expanded', 'false');
    expect(painel).toHaveAttribute('data-state', 'fechado');
    expect(painel.style.maxHeight).toBe('0px');

    await userEvent.click(cabecalho);
    expect(cabecalho).toHaveAttribute('aria-expanded', 'true');
    expect(painel).toHaveAttribute('data-state', 'aberto');
    expect(painel.style.maxHeight).toBe('68px');
  });

  it('o painel de itens declara o mecanismo de colapso do prototipo', () => {
    mockPathname.mockReturnValue('/comercial/clientes');
    render(<NavGroup title="GESTÃO" items={itens} defaultOpen />);

    const painel = painelDe(screen.getByRole('button', { name: /GESTÃO/ }));
    expect(painel.className).toContain('overflow-hidden');
    expect(painel.className).toContain('transition-[max-height]');
    expect(painel.className).toContain('duration-[220ms]');
  });

  it('abre o grupo automaticamente quando um item esta ativo', () => {
    mockPathname.mockReturnValue('/gestao/compras');
    render(<NavGroup title="GESTÃO" items={itens} />);
    expect(screen.getByRole('button', { name: /GESTÃO/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('marca o item ativo com aria-current', () => {
    mockPathname.mockReturnValue('/gestao/compras');
    render(<NavGroup title="GESTÃO" items={itens} />);
    expect(screen.getByRole('link', { name: 'Compras' })).toHaveAttribute('aria-current', 'page');
  });
});
