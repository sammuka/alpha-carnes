import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ReadableStream } from 'node:stream/web';

const mockApiFetch = jest.fn();

jest.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL;
    headers: Headers;
    constructor(url: string, init?: RequestInit) {
      this.nextUrl = new URL(url);
      this.headers = new Headers(init?.headers);
      this._body = init?.body ?? null;
    }
    private _body: BodyInit | null;
    text = async () => JSON.stringify({ test: true });
    arrayBuffer = async () => {
      if (this._body instanceof ArrayBuffer) return this._body;
      if (ArrayBuffer.isView(this._body)) {
        const view = this._body as ArrayBufferView;
        return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
      }
      return new ArrayBuffer(0);
    };
  },
  NextResponse: class {
    status: number;
    headers: Headers;
    private stream: ReadableStream | null;
    private textBody: string | null;
    constructor(body: ReadableStream | string | null, init?: { status?: number; headers?: HeadersInit }) {
      if (typeof body === 'string') {
        this.textBody = body;
        this.stream = null;
      } else {
        this.stream = body;
        this.textBody = null;
      }
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }
    text = async () => this.textBody ?? '';
    json = async () => (this.textBody ? JSON.parse(this.textBody) : null);
    arrayBuffer = async () => {
      if (!this.stream) return new ArrayBuffer(0);
      const reader = this.stream.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) chunks.push(result.value);
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      return out.buffer;
    };
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

it.each([400, 403] as const)(
  'repassa representantes permitidos sem mascarar erro HTTP %s',
  async (statusBackend) => {
    const requestBytes = Buffer.from(
      '{"representantes":["00000000-0000-4000-8000-000000000001"]}',
    );
    const responseBytes = Buffer.from(
      '{"code":"REPRESENTANTES_INVALIDOS","detalhe":"á"}',
    );
    mockApiFetch.mockResolvedValueOnce({
      status: statusBackend,
      headers: new Headers({ 'Content-Type': 'application/problem+json; charset=utf-8' }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(responseBytes));
          controller.close();
        },
      }),
    });

    const { PUT: putRepresentantes } = await import(
      '../src/app/api/admin/usuarios/[id]/representantes/route'
    );
    const request = new NextRequest(
      'http://localhost/api/admin/usuarios/u-1/representantes',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: requestBytes,
      },
    );
    const response = await putRepresentantes(request, {
      params: Promise.resolve({ id: 'u-1' }),
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      '/usuarios/u-1/representantes',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const [, init] = mockApiFetch.mock.calls[0]!;
    expect(Buffer.from(init!.body as ArrayBuffer)).toEqual(requestBytes);
    expect(response.status).toBe(statusBackend);
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json; charset=utf-8',
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(responseBytes);
  },
);
