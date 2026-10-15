const mockApiFetch = jest.fn();

jest.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL;
    constructor(url: string) { this.nextUrl = new URL(url); }
  },
  NextResponse: class {
    status: number;
    constructor(_corpo: unknown, init?: { status?: number }) { this.status = init?.status ?? 200; }
  },
}));
jest.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/contabilidade/plano/opcoes-pai/route';

it('repassa a consulta ao backend e devolve o status dele', async () => {
  mockApiFetch.mockResolvedValue({ status: 403, text: async () => '{"message":"Forbidden"}' });
  const res = await GET(new NextRequest('http://interno/api/contabilidade/plano/opcoes-pai?q=cx') as never);
  expect(mockApiFetch).toHaveBeenCalledWith('/contabilidade/plano/opcoes-pai?q=cx', { method: 'GET' });
  expect(res.status).toBe(403);
});
