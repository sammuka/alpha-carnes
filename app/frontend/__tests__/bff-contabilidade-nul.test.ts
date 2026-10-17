const mockApiFetch = jest.fn();

jest.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) { this.nextUrl = new URL(url); }
    async text() { return '{}'; }
  },
  NextResponse: class {
    status: number;
    constructor(_corpo: unknown, init?: { status?: number }) { this.status = init?.status ?? 200; }
  },
}));
jest.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { NextRequest } from 'next/server';
import { GET as listarPlano } from '@/app/api/contabilidade/plano/route';
import { GET as historicoPlano } from '@/app/api/contabilidade/plano/[codigo]/historico/route';
import { POST as acaoPlano } from '@/app/api/contabilidade/plano/[codigo]/[acao]/route';
import { POST as acaoPolitica } from '@/app/api/contabilidade/politicas/[codigo]/[acao]/route';
import { GET as exportarPolitica } from '@/app/api/contabilidade/politicas/exportar/route';

const NUL = String.fromCharCode(0);

beforeEach(() => mockApiFetch.mockReset());

it('NUL no caminho ou na busca responde 400 e não chega ao backend', async () => {
  const req = (url: string) => new NextRequest(url) as never;
  const respostas = [
    await listarPlano(req('http://interno/api/contabilidade/plano?q=a%00')),
    await historicoPlano(req('http://interno/x'), { params: Promise.resolve({ codigo: `1${NUL}` }) }),
    await acaoPlano(req('http://interno/x'), { params: Promise.resolve({ codigo: `1${NUL}`, acao: 'aprovar' }) }),
    await acaoPolitica(req('http://interno/x'), { params: Promise.resolve({ codigo: `X${NUL}`, acao: 'aprovar' }) }),
    await exportarPolitica(req('http://interno/api/contabilidade/politicas/exportar?q=%00')),
  ];
  expect(respostas.map((r) => r.status)).toEqual([400, 400, 400, 400, 400]);
  expect(mockApiFetch).not.toHaveBeenCalled();
});

it('busca com % literal (%25) segue para o backend', async () => {
  mockApiFetch.mockResolvedValue({ status: 200, text: async () => '{}' });
  const res = await listarPlano(new NextRequest('http://interno/api/contabilidade/plano?q=%2500') as never);
  expect(res.status).toBe(200);
  expect(mockApiFetch).toHaveBeenCalledWith('/contabilidade/plano?q=%2500', { method: 'GET' });
});
