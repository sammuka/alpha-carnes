/** @jest-environment node */
const mockApiFetch = jest.fn();

jest.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) {
      this.nextUrl = new URL(url);
    }
  },
  NextResponse: class {
    status: number;
    headers: Headers;
    body: string | ArrayBuffer | null;
    constructor(body: string | ArrayBuffer | null, init?: { status?: number; headers?: HeadersInit }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers);
    }
  },
}));
jest.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/contabilidade/plano/exportar/route';

const csv = '﻿Conta contábil;Situação\nCaixa e bancos;Aprovado';
const bytesCsv = new TextEncoder().encode(csv);
const buffer = bytesCsv.buffer.slice(bytesCsv.byteOffset, bytesCsv.byteOffset + bytesCsv.byteLength);

beforeEach(() => mockApiFetch.mockReset());

it('repassa o filtro, o text/csv, o Content-Disposition e os bytes do backend, inclusive o BOM', async () => {
  mockApiFetch.mockResolvedValue({
    ok: true,
    status: 200,
    // Como a Response real: text() decodifica e descarta o BOM; só arrayBuffer() mantém EF BB BF.
    text: async () => csv.replace('﻿', ''),
    arrayBuffer: async () => buffer,
    headers: new Headers({
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="plano-de-contas.csv"',
    }),
  });
  const resposta = await GET(new NextRequest('http://interno/api/contabilidade/plano/exportar?q=a&ordenar=contaContabil') as never);
  expect(mockApiFetch).toHaveBeenCalledWith('/contabilidade/plano/exportar?q=a&ordenar=contaContabil', { method: 'GET' });
  expect(resposta.status).toBe(200);
  expect(resposta.headers.get('content-type')).toBe('text/csv; charset=utf-8');
  expect(resposta.headers.get('content-disposition')).toBe('attachment; filename="plano-de-contas.csv"');
  const corpo = (resposta as unknown as { body: ArrayBuffer }).body;
  expect(corpo).toBeInstanceOf(ArrayBuffer);
  expect(Array.from(new Uint8Array(corpo).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  expect(new Uint8Array(corpo)).toEqual(bytesCsv);
});

it('erro do backend segue como JSON com o status original', async () => {
  mockApiFetch.mockResolvedValue({
    ok: false,
    status: 400,
    text: async () => '{"message":"Validação falhou"}',
    headers: new Headers({ 'content-type': 'application/json' }),
  });
  const resposta = await GET(new NextRequest('http://interno/api/contabilidade/plano/exportar?pagina=0') as never);
  expect(resposta.status).toBe(400);
  expect(resposta.headers.get('content-type')).toBe('application/json');
  expect(resposta.headers.get('content-disposition')).toBeNull();
});
