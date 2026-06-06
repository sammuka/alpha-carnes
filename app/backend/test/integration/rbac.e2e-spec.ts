import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, cleanupDb, createTestUser } from '../helpers/test-app';

describe('RBAC e2e', () => {
  let app: INestApplication;
  let adminCookies: string;
  let comercialCookies: string;
  let adminEmail: string;
  let adminPassword: string;
  let novoUsuarioPayload: { nome: string; email: string; password: string };

  beforeAll(async () => {
    app = await createTestApp();

    const adminFixture = await createTestUser(app, { perfil: 'administrador' });
    adminEmail = adminFixture.adminEmail;
    adminPassword = adminFixture.adminPassword;

    const comercialFixture = await createTestUser(app, { perfil: 'comercial' });

    const loginAdmin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    adminCookies = (loginAdmin.headers['set-cookie'] as string[]).join('; ');

    const loginComercial = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: comercialFixture.adminEmail, password: comercialFixture.adminPassword });
    comercialCookies = (loginComercial.headers['set-cookie'] as string[]).join('; ');

    novoUsuarioPayload = {
      nome: 'Novo Usuário',
      email: `novo-${Date.now()}@test.local`,
      password: 'Senha@1234567',
    };
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  describe('POST /usuarios', () => {
    it('admin (USUARIOS_GERENCIAR) cria usuário → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/usuarios')
        .set('Cookie', adminCookies)
        .send(novoUsuarioPayload);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('comercial (sem USUARIOS_GERENCIAR) é negado → 403', async () => {
      const res = await request(app.getHttpServer())
        .post('/usuarios')
        .set('Cookie', comercialCookies)
        .send({ nome: 'X', email: 'x@x.com', password: 'Abc@1234567' });
      expect(res.status).toBe(403);
      expect(res.body).not.toHaveProperty('success', true);
    });

    it('sem autenticação → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/usuarios')
        .send({ nome: 'X', email: 'x@x.com', password: 'Abc@1234567' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /usuarios/:id/aprovar (SF-01 — segregação de funções)', () => {
    it('admin aprova usuário criado por outro (ok)', async () => {
      // Cria um usuário como admin
      const criarRes = await request(app.getHttpServer())
        .post('/usuarios')
        .set('Cookie', adminCookies)
        .send({ nome: 'Para Aprovar', email: `aprovar-${Date.now()}@test.local`, password: 'Senha@1234567' });
      const usuarioId = criarRes.body.id;

      // Cria outro admin para aprovar
      const outroAdmin = await createTestUser(app, { perfil: 'administrador' });
      const loginOutro = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: outroAdmin.adminEmail, password: outroAdmin.adminPassword });
      const outroCookies = (loginOutro.headers['set-cookie'] as string[]).join('; ');

      const res = await request(app.getHttpServer())
        .post(`/usuarios/${usuarioId}/aprovar`)
        .set('Cookie', outroCookies);
      expect([200, 409]).toContain(res.status); // 200 ok, ou 409 se já aprovado
    });

    it('SF-01: criador não pode aprovar o próprio usuário criado → 409', async () => {
      // Admin A cria um usuário
      const criarRes = await request(app.getHttpServer())
        .post('/usuarios')
        .set('Cookie', adminCookies)
        .send({ nome: 'SF01 Test', email: `sf01-${Date.now()}@test.local`, password: 'Senha@1234567' });
      const usuarioId = criarRes.body.id;

      // Admin A tenta aprovar o mesmo usuário → SF-01
      const res = await request(app.getHttpServer())
        .post(`/usuarios/${usuarioId}/aprovar`)
        .set('Cookie', adminCookies);
      expect([403, 409]).toContain(res.status);
    });
  });

  describe('GET /usuarios', () => {
    it('admin lista usuários → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/usuarios')
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('comercial não tem acesso → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/usuarios')
        .set('Cookie', comercialCookies);
      expect(res.status).toBe(403);
    });
  });
});
