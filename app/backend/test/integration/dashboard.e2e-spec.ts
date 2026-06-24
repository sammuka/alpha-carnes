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
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('GET /gestao/dashboard retorna resumo do dia', async () => {
    const res = await request(srv()).get('/gestao/dashboard').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      comprasProgramadas: expect.objectContaining({ total: expect.any(Number), porStatus: expect.any(Object) }),
      pedidos: expect.objectContaining({ total: expect.any(Number), porStatus: expect.any(Object) }),
      pedidosEmAndamento: expect.any(Array),
      atividadesRecentes: expect.any(Array),
      divergenciasAbertas: expect.any(Number),
      caminhoesDoDia: expect.any(Number),
      disponibilidade: expect.objectContaining({
        itens: expect.any(Number),
        itensEsgotados: expect.any(Number),
        quantidadeDisponivelTotal: expect.any(String),
      }),
    });
  });

  it('GET /gestao/dashboard?dataOperacao=2026-06-01 filtra por data', async () => {
    const res = await request(srv())
      .get('/gestao/dashboard')
      .query({ dataOperacao: '2026-06-01' })
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.dataOperacao).toBe('2026-06-01');
  });

  it('dataOperacao inválida → 400', async () => {
    const res = await request(srv())
      .get('/gestao/dashboard')
      .query({ dataOperacao: '01-06-2026' })
      .set('Cookie', adminCookies);
    expect(res.status).toBe(400);
  });
});
