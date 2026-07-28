import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('Dashboard e2e', () => {
  let app: INestApplication;
  let adminCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);

    const hoje = new Date().toISOString().slice(0, 10);
    await request(srv())
      .post('/operacoes/extraordinaria')
      .set('Cookie', adminCookies)
      .send({ data: hoje, rotulo: 'Dashboard E2E setup' });
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('GET /gestao/dashboard retorna resumo da operação corrente', async () => {
    const res = await request(srv()).get('/gestao/dashboard').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      operacao: expect.objectContaining({
        id: expect.any(String),
        data: expect.any(String),
        rotulo: expect.any(String),
        status: expect.any(String),
      }),
      kpis: expect.any(Array),
      pedidosEmAndamento: expect.any(Array),
      alertas: expect.any(Array),
      atividadesRecentes: expect.any(Array),
    });
    expect(res.body.kpis).toHaveLength(10);
  });

  it('GET /gestao/dashboard?operacaoId= filtra por operação', async () => {
    const op = await request(srv())
      .post('/operacoes/extraordinaria')
      .set('Cookie', adminCookies)
      .send({ data: '2031-03-15', rotulo: 'Dashboard E2E' });
    expect(op.status).toBe(201);

    const res = await request(srv())
      .get('/gestao/dashboard')
      .query({ operacaoId: op.body.id })
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.operacao).toMatchObject({ id: op.body.id, data: '2031-03-15' });
  });

  it('operacaoId inválido → 400', async () => {
    const res = await request(srv())
      .get('/gestao/dashboard')
      .query({ operacaoId: 'nao-e-uuid' })
      .set('Cookie', adminCookies);
    expect(res.status).toBe(400);
  });
});
