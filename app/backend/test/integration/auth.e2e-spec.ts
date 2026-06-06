import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, cleanupDb, createTestUser } from '../helpers/test-app';

const THROTTLE_LIMIT = parseInt(process.env.THROTTLE_LOGIN_LIMIT ?? '5', 10);

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
      expect(res.headers['set-cookie']).toBeDefined();
      const cookies = (res.headers['set-cookie'] as string[]).join(';');
      expect(cookies).toContain('access_token');
      expect(cookies).toContain('HttpOnly');
    });

    it('retorna 401 em credenciais inválidas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminEmail, password: 'senha-errada' });
      expect(res.status).toBe(401);
      expect(res.body).not.toHaveProperty('success', true);
    });

    it('retorna 429 após exceder o limite de tentativas (rate limiting)', async () => {
      // Usar email diferente para não colidir com o throttler de outros testes
      const bruteEmail = `brute-${Date.now()}@test.local`;
      for (let i = 0; i < THROTTLE_LIMIT; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: bruteEmail, password: 'wrong' });
      }
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: bruteEmail, password: 'wrong' });
      expect(res.status).toBe(429);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotaciona refresh token e revoga o anterior', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
      const cookies = (loginRes.headers['set-cookie'] as string[]).join('; ');

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
  });

  describe('POST /auth/logout', () => {
    it('revoga o refresh token — refresh subsequente retorna 401', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixtures.adminEmail, password: fixtures.adminPassword });
      const cookies = (loginRes.headers['set-cookie'] as string[]).join('; ');

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
      const cookies = (loginRes.headers['set-cookie'] as string[]).join('; ');

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
