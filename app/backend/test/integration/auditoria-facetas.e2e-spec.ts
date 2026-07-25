import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('Auditoria facetas e2e', () => {
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

  it('auditoria filtra por periodo, usuario, modulo, operacao e registro', async () => {
    const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'AUD-1A11' });
    const registroId = criar.body.id as string;
    const inicio = new Date(Date.now() - 60_000).toISOString();
    const fim = new Date(Date.now() + 60_000).toISOString();

    const filtrado = await request(srv())
      .get(`/auditoria?modulo=cadastros&operacao=INSERT&tabela=frota_caminhoes&registroId=${registroId}&dataInicio=${inicio}&dataFim=${fim}`)
      .set('Cookie', adminCookies);
    expect(filtrado.status).toBe(200);
    expect(filtrado.body.total).toBe(1);

    const foraDaJanela = await request(srv())
      .get(`/auditoria?dataInicio=${new Date(Date.now() + 3_600_000).toISOString()}`)
      .set('Cookie', adminCookies);
    expect(foraDaJanela.body.total).toBe(0);
  });

  it('facetas de auditoria listam valores distintos reais', async () => {
    const res = await request(srv()).get('/auditoria/facetas').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.modulos).toContain('cadastros');
    expect(res.body.tabelas).toContain('frota_caminhoes');
    expect(res.body.usuarios.length).toBeGreaterThanOrEqual(1);
  });

  it('filtro de registro aceita trecho e valida uuid', async () => {
    const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'AUD-2B22' });
    const trecho = (criar.body.id as string).slice(0, 8);

    const porTrecho = await request(srv())
      .get(`/auditoria?registroBusca=${trecho}`).set('Cookie', adminCookies);
    expect(porTrecho.body.total).toBeGreaterThanOrEqual(1);

    const uuidInvalido = await request(srv())
      .get('/auditoria?registroId=PED-123').set('Cookie', adminCookies);
    expect(uuidInvalido.status).toBe(400);
  });
});
