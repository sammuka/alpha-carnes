import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { AuditoriaAdminClient } from '../src/app/(admin)/admin/auditoria/auditoria-client';

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

const FACETAS = {
  modulos: ['cadastros', 'auth'],
  tabelas: ['produtos'],
  usuarios: [{ id: 'u1', nome: 'Admin' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  Element.prototype.scrollIntoView = jest.fn();
  global.URL.createObjectURL = jest.fn(() => 'blob:csv');
  global.URL.revokeObjectURL = jest.fn();

  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/facetas')) {
      return Promise.resolve({ ok: true, json: async () => FACETAS });
    }
    if (String(url).includes('/usuarios')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 'u1', nome: 'Admin', email: 'admin@alpha.local' }],
      });
    }
    if (String(url).includes('/export')) {
      return Promise.resolve({
        ok: true,
        headers: { get: (h: string) => (h === 'X-Auditoria-Truncado' ? '0' : null) },
        blob: async () => new Blob(['csv']),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
    });
  }) as unknown as typeof fetch;
});

it('cinco filtros do prototipo estao presentes', async () => {
  render(<AuditoriaAdminClient />);
  expect(await screen.findByText('Período')).toBeInTheDocument();
  expect(screen.getByText('Usuário')).toBeInTheDocument();
  expect(screen.getByText('Módulo')).toBeInTheDocument();
  expect(screen.getByText('Operação')).toBeInTheDocument();
  expect(screen.getByLabelText('Registro (ID)')).toBeInTheDocument();
});

it('selects de Usuario e Modulo populados por facetas', async () => {
  render(<AuditoriaAdminClient />);
  await screen.findByRole('combobox', { name: 'Usuário' });
  fireEvent.click(screen.getByRole('combobox', { name: 'Usuário' }));
  expect(await screen.findByRole('option', { name: /Admin/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: 'Módulo' }));
  expect(await screen.findByRole('option', { name: 'cadastros' })).toBeInTheDocument();
});

it('UUID completo manda registroId e texto parcial manda registroBusca', async () => {
  const fetchMock = global.fetch as jest.Mock;
  render(<AuditoriaAdminClient />);
  await screen.findByLabelText('Registro (ID)');

  const uuid = '019e9e00-0000-7000-8000-000000000123';
  fireEvent.change(screen.getByLabelText('Registro (ID)'), { target: { value: uuid } });
  fireEvent.click(screen.getByRole('button', { name: /Aplicar Filtros/i }));

  await waitFor(() => {
    const chamada = fetchMock.mock.calls.find(([url]) => String(url).includes('registroId='));
    expect(chamada).toBeDefined();
    expect(String(chamada?.[0])).toContain(`registroId=${uuid}`);
  });

  fireEvent.change(screen.getByLabelText('Registro (ID)'), { target: { value: 'abc123' } });
  fireEvent.click(screen.getByRole('button', { name: /Aplicar Filtros/i }));

  await waitFor(() => {
    const chamada = fetchMock.mock.calls.find(([url]) => String(url).includes('registroBusca=abc123'));
    expect(chamada).toBeDefined();
  });
});

it('Exportar CSV chama export com filtros e dispara download', async () => {
  const fetchMock = global.fetch as jest.Mock;
  const click = jest.fn();
  const originalCreate = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = originalCreate(tag);
    if (tag === 'a') {
      Object.defineProperty(el, 'click', { value: click });
    }
    return el;
  });

  render(<AuditoriaAdminClient />);
  await screen.findByRole('button', { name: /Exportar CSV/i });
  fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/i }));

  await waitFor(() => {
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/admin/auditoria/export'))).toBe(
      true,
    );
    expect(click).toHaveBeenCalled();
  });
});

it('cabecalho X-Auditoria-Truncado 1 mostra aviso', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/facetas')) {
      return Promise.resolve({ ok: true, json: async () => FACETAS });
    }
    if (String(url).includes('/usuarios')) {
      return Promise.resolve({
        ok: true,
        json: async () => [{ id: 'u1', nome: 'Admin', email: 'admin@alpha.local' }],
      });
    }
    if (String(url).includes('/export')) {
      return Promise.resolve({
        ok: true,
        headers: { get: (h: string) => (h === 'X-Auditoria-Truncado' ? '1' : null) },
        blob: async () => new Blob(['csv']),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: [], total: 0, page: 1, pageSize: 20 }),
    });
  }) as unknown as typeof fetch;

  render(<AuditoriaAdminClient />);
  fireEvent.click(await screen.findByRole('button', { name: /Exportar CSV/i }));

  await waitFor(() => {
    expect(toast.warning).toHaveBeenCalledWith(
      'Exportação truncada em 5000 registros. Refine o período.',
    );
  });
});
