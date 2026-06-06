import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, joinSetCookie } from '../helpers/test-app';

describe('Auth e2e', () => {
  let app: INestApplication;
  let fixtures: { adminEmail: string; adminPassword: string };

  beforeAll(async () => {
    app = await createTestApp();
    fixtures = await createTestUser(app, { perfil: 'administrador' });
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('retorna 200 e seta cookies httpOnly em credenciais válidas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
      expect(res.status).toBe(200);
      const rawCookies = res.headers['set-cookie'] as unknown as string[];
      expect(rawCookies).toBeDefined();
      const rawJoined = rawCookies.join(' | ');
      expect(rawJoined).toContain('access_token');
      expect(rawJoined).toContain('refresh_token');
      // httpOnly sempre presente; secure ausente em dev (COOKIE_SECURE=false)
      expect(rawJoined).toContain('HttpOnly');
      expect(rawJoined).not.toContain('Secure');
    });

    it('retorna 401 em credenciais inválidas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminEmail, password: 'senha-errada' });
      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty('success', true);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotaciona refresh token e revoga o anterior', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
      const cookies = joinSetCookie(loginRes);

      // Primeiro refresh: deve funcionar
      const r1 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookies);
      expect(r1.status).toBe(200);

      // Segundo refresh com o mesmo cookie (rotacionado = revogado): deve falhar
      const r2 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookies);
      expect(r2.status).toBe(401);
    });

    it('reuse detection: reusar refresh revogado invalida a família inteira', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
      const cookies = joinSetCookie(loginRes);

      // Rotaciona — o cookie original fica revogado e recebemos um novo refresh
      const r1 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookies);
      expect(r1.status).toBe(200);
      const novosCookies = joinSetCookie(r1);

      // Reusar o refresh ANTIGO (revogado) → 401 + dispara reuse detection
      const reuse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookies);
      expect(reuse.status).toBe(401);

      // A família foi revogada: o refresh NOVO (legítimo) também deve falhar agora
      const familiaRevogada = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', novosCookies);
      expect(familiaRevogada.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revoga o refresh token — refresh subsequente retorna 401', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
      const cookies = joinSetCookie(loginRes);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookies)
        .expect(200);

      const r = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookies);
      expect(r.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('retorna dados do usuário + permissões efetivas', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
      const cookies = joinSetCookie(loginRes);

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookies);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sub');
      expect(res.body).toHaveProperty('permissoes');
      expect(Array.isArray(res.body.permissoes)).toBe(true);
    });
  });
});

// Suíte isolada: o teste de rate limiting esgota o throttler (por IP), então usa
// um app próprio com ThrottlerStorage em memória independente — não contamina os
// demais testes de login/refresh.
describe('Auth e2e — rate limiting', () => {
  const RATE_LIMIT = 5;
  let app: INestApplication;

  beforeAll(async () => {
    // App dedicado com limite baixo e throttler em memória isolado
    app = await createTestApp({ THROTTLE_LOGIN_LIMIT: String(RATE_LIMIT) });
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('retorna 429 ao exceder o limite de tentativas de login (RA-06)', async () => {
    const bruteEmail = `brute-${Date.now()}@test.local`;
    let last = 200;
    // Estoura o limite + 1 para garantir o 429
    for (let i = 0; i <= RATE_LIMIT; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: bruteEmail, password: 'wrong' });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
