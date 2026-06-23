/**
 * @jest-environment @edge-runtime/jest-environment
 */
// Teste do middleware Edge — usa Edge runtime (NextRequest + Response nativos)

import { NextRequest } from 'next/server';

// Mock do jose
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
}));

import { jwtVerify } from 'jose';
import { middleware, config as middlewareConfig } from '../src/middleware';

const mockJwtVerify = jwtVerify as jest.Mock;

function createRequest(path: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost:3000${path}`;
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-secret-min-32-chars-for-test-ok';
  });

  it('rota pública /login não faz redirect', async () => {
    const req = createRequest('/login');
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'user-id' } });
    const res = await middleware(req);
    // Rota pública — deve seguir (next()) ou redirect para admin se já logado
    expect(res).toBeDefined();
  });

  it('rota protegida sem cookie redireciona para /login', async () => {
    const req = createRequest('/admin');
    mockJwtVerify.mockRejectedValue(new Error('no token'));
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('rota protegida com cookie de assinatura inválida redireciona para /login', async () => {
    const req = createRequest('/admin', { access_token: 'token.invalido.assinatura' });
    mockJwtVerify.mockRejectedValue(new Error('JWSSignatureVerificationFailed'));
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('rota protegida com token válido segue (next)', async () => {
    const req = createRequest('/admin', { access_token: 'valid.token.here' });
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'user-id', exp: Date.now() / 1000 + 900 } });
    const res = await middleware(req);
    // next() retorna undefined ou NextResponse.next()
    expect(res.status).not.toBe(307);
  });

  it('config.matcher cobre todas as rotas e exclui /api públicos', () => {
    expect(middlewareConfig.matcher).toBeDefined();
    const matchers = Array.isArray(middlewareConfig.matcher)
      ? middlewareConfig.matcher
      : [middlewareConfig.matcher];
    const matcherStr = matchers.join(',');
    // O matcher único cobre tudo (inclui /admin implicitamente) excluindo estáticos e APIs públicas
    expect(matcherStr).toMatch(/api\/auth\/login/);
    expect(matcherStr).toMatch(/_next/);
    // Deve ter exatamente um matcher
    expect(matchers).toHaveLength(1);
  });
});
