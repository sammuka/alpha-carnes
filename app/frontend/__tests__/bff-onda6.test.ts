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
    }
    text = async () => JSON.stringify({ test: true });
  },
  NextResponse: class {
    status: number;
    headers: Headers;
    constructor(body: ReadableStream | string | null, init?: { status?: number; headers?: HeadersInit }) {
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }
  },
}));

jest.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { NextRequest as NR } from 'next/server';

describe('BFF Onda 6', () => {
  const apiRoot = join(__dirname, '../src/app/api');

  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: null,
    });
  });

  it('não existe rota app/api/operacao/recebimentos/[id]/nf', () => {
    expect(existsSync(join(apiRoot, 'operacao/recebimentos/[id]/nf/route.ts'))).toBe(false);
  });

  it('trocas, estornar, listar e cancelar etiqueta repassam ao backend sem decidir', async () => {
    const { POST: postTrocas } = await import('../src/app/api/operacao/pesagem/trocas/route');
    const { POST: postEstornar } = await import('../src/app/api/operacao/pesagem/pecas/[id]/estornar/route');
    const { GET: getEtiquetas } = await import('../src/app/api/operacao/etiquetas/route');
    const { POST: postCancelar } = await import('../src/app/api/operacao/etiquetas/[id]/cancelar/route');

    const trocas = await postTrocas(new NR('http://localhost/api/operacao/pesagem/trocas', { method: 'POST' }) as never);
    expect(mockApiFetch).toHaveBeenCalledWith('/operacao/pesagem/trocas', expect.objectContaining({ method: 'POST' }));
    expect(trocas.status).toBe(409);

    mockApiFetch.mockClear();
    mockApiFetch.mockResolvedValue({
      status: 403,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: null,
    });
    const estornar = await postEstornar(
      new NR('http://localhost/api/operacao/pesagem/pecas/x/estornar', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'peca-1' }) },
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/operacao/pesagem/pecas/peca-1/estornar',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(estornar.status).toBe(403);

    mockApiFetch.mockClear();
    mockApiFetch.mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: null,
    });
    const listar = await getEtiquetas(
      new NR('http://localhost/api/operacao/etiquetas?recebimentoId=r1') as never,
    );
    expect(mockApiFetch).toHaveBeenCalledWith('/operacao/etiquetas?recebimentoId=r1');
    expect(listar.status).toBe(200);

    mockApiFetch.mockClear();
    mockApiFetch.mockResolvedValue({
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: null,
    });
    const cancelar = await postCancelar(
      new NR('http://localhost/api/operacao/etiquetas/e1/cancelar', { method: 'POST' }) as never,
      { params: Promise.resolve({ id: 'e1' }) },
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/operacao/etiquetas/e1/cancelar',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(cancelar.status).toBe(409);
  });
});
