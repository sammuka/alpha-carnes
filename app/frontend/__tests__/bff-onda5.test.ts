import { existsSync } from 'node:fs';
import { join } from 'node:path';

const mockApiFetch = jest.fn();

jest.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) {
      this.nextUrl = new URL(url);
    }
    text = async () => JSON.stringify({ test: true });
  },
  NextResponse: class {
    status: number;
    private body: string | null;
    constructor(body: string | null, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    text = async () => this.body ?? '';
    json = async () => (this.body ? JSON.parse(this.body) : null);
  },
}));

jest.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { NextRequest } from 'next/server';

const ROTAS_NOVAS = [
  'operacoes/route.ts',
  'operacoes/[id]/route.ts',
  'operacoes/[id]/status/route.ts',
  'operacoes/extraordinaria/route.ts',
  'operacoes/gerar-cadencia/route.ts',
  'comercial/compras-programadas/[id]/impacto/route.ts',
  'comercial/compras-programadas/[id]/historico/route.ts',
  'comercial/overbooking/[id]/cobertura/route.ts',
  'comercial/overbooking/[id]/historico/route.ts',
  'comercial/overbooking/[id]/status/route.ts',
  'gestao/aprovacoes/route.ts',
  'gestao/aprovacoes/ocorrencias/[id]/comparativo/route.ts',
  'gestao/aprovacoes/operacionais/route.ts',
  'gestao/aprovacoes/operacionais/[id]/decidir/route.ts',
  'sif/relatorios/route.ts',
  'sif/relatorios/[id]/versoes/route.ts',
  'sif/relatorios/[id]/preview/route.ts',
  'sif/relatorios/[id]/gerar/route.ts',
  'sif/relatorios/[id]/retificar/route.ts',
  'operacao/ocorrencias-fornecedor/route.ts',
  'operacao/ocorrencias-fornecedor/[id]/route.ts',
  'operacao/ocorrencias-fornecedor/[id]/encerrar/route.ts',
];

beforeEach(() => {
  mockApiFetch.mockReset();
});

it('todas as rotas BFF novas da Onda 5 existem', () => {
  const faltando = ROTAS_NOVAS.filter((rota) => !existsSync(join('src', 'app', 'api', rota)));
  expect(faltando).toEqual([]);
});

it('GET /api/operacoes repassa query string', async () => {
  mockApiFetch.mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify({ data: [] }),
  });
  const { GET } = await import('../src/app/api/operacoes/route');
  await GET(new NextRequest('http://localhost/api/operacoes?status=aberta&de=2026-01-01'));
  expect(mockApiFetch).toHaveBeenCalledWith('/operacoes?status=aberta&de=2026-01-01', { method: 'GET' });
});

it('GET /api/gestao/dashboard repassa operacaoId', async () => {
  mockApiFetch.mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify({ kpis: [] }),
  });
  const { GET } = await import('../src/app/api/gestao/dashboard/route');
  await GET(new NextRequest('http://localhost/api/gestao/dashboard?operacaoId=abc-123'));
  expect(mockApiFetch).toHaveBeenCalledWith('/gestao/dashboard?operacaoId=abc-123', { method: 'GET' });
});

it('PATCH item compra repassa 409 com impacto íntegro', async () => {
  const corpo409 = JSON.stringify({
    codigo: 'IMPACTO_CONFIRMACAO_NECESSARIA',
    message: 'confirme',
    impacto: { deficitTotal: '3.000', exigeConfirmacao: true, itens: [] },
  });
  mockApiFetch.mockResolvedValue({ status: 409, text: async () => corpo409 });
  const { PATCH } = await import('../src/app/api/comercial/compras-programadas/[id]/itens/[itemId]/route');
  const res = await PATCH(new NextRequest('http://localhost/api/x'), {
    params: Promise.resolve({ id: 'compra-1', itemId: 'item-1' }),
  });
  expect(res.status).toBe(409);
  expect(mockApiFetch).toHaveBeenCalledWith('/comercial/compras-programadas/compra-1/itens/item-1', {
    method: 'PATCH',
    body: JSON.stringify({ test: true }),
  });
  const texto = await res.text();
  expect(texto).toContain('impacto');
  expect(JSON.parse(texto).impacto.deficitTotal).toBe('3.000');
});

it('POST gerar SIF repassa 409 com pendencias íntegro', async () => {
  const corpo409 = JSON.stringify({
    codigo: 'RELATORIO_COM_PENDENCIAS',
    message: 'pendências',
    pendencias: ['pesagem sem origem'],
  });
  mockApiFetch.mockResolvedValue({ status: 409, text: async () => corpo409 });
  const { POST } = await import('../src/app/api/sif/relatorios/[id]/gerar/route');
  const res = await POST(new NextRequest('http://localhost/api/x'), {
    params: Promise.resolve({ id: 'rel-1' }),
  });
  expect(res.status).toBe(409);
  expect(mockApiFetch).toHaveBeenCalledWith('/sif/relatorios/rel-1/gerar', { method: 'POST' });
  const parsed = JSON.parse(await res.text());
  expect(parsed.pendencias).toEqual(['pesagem sem origem']);
});

it('PATCH ocorrência e POST encerrar batem nos caminhos corretos', async () => {
  mockApiFetch.mockResolvedValue({ status: 200, text: async () => '{}' });
  const { PATCH } = await import('../src/app/api/operacao/ocorrencias-fornecedor/[id]/route');
  await PATCH(new NextRequest('http://localhost/api/x'), {
    params: Promise.resolve({ id: 'oc-99' }),
  });
  expect(mockApiFetch).toHaveBeenLastCalledWith('/operacao/ocorrencias-fornecedor/oc-99', {
    method: 'PATCH',
    body: JSON.stringify({ test: true }),
  });

  const { POST } = await import('../src/app/api/operacao/ocorrencias-fornecedor/[id]/encerrar/route');
  await POST(new NextRequest('http://localhost/api/x'), {
    params: Promise.resolve({ id: 'oc-99' }),
  });
  expect(mockApiFetch).toHaveBeenLastCalledWith('/operacao/ocorrencias-fornecedor/oc-99/encerrar', {
    method: 'POST',
    body: JSON.stringify({ test: true }),
  });
});

it('GET impacto repassa simulacao na query', async () => {
  mockApiFetch.mockResolvedValue({ status: 200, text: async () => '{}' });
  const { GET } = await import('../src/app/api/comercial/compras-programadas/[id]/impacto/route');
  await GET(new NextRequest('http://localhost/api/x?simulacao=uuid:10'), {
    params: Promise.resolve({ id: 'c1' }),
  });
  expect(mockApiFetch).toHaveBeenCalledWith(
    '/comercial/compras-programadas/c1/impacto?simulacao=uuid:10',
    { method: 'GET' },
  );
});
