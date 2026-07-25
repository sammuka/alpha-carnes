import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('Frota e2e (caminhões de cadastro e motoristas)', () => {
  let app: INestApplication;
  let adminCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('caminhao de frota: ciclo CRUD, placa duplicada e restauracao', async () => {
    const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'ABC-1D23', descricao: 'Baú refrigerado', capacidadeKg: 4500 });
    expect(criar.status).toBe(201);
    const id = criar.body.id as string;

    const dup = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'ABC-1D23' });
    expect(dup.status).toBe(409);

    const editar = await request(srv()).patch(`/frota/caminhoes/${id}`).set('Cookie', adminCookies)
      .send({ capacidadeKg: 6000, status: 'inativo' });
    expect(editar.status).toBe(200);
    expect(editar.body.capacidadeKg).toBe(6000);

    const lista = await request(srv()).get('/frota/caminhoes?search=ABC').set('Cookie', adminCookies);
    expect(lista.status).toBe(200);
    expect(lista.body.total).toBe(1);

    expect((await request(srv()).delete(`/frota/caminhoes/${id}`).set('Cookie', adminCookies)).status).toBe(200);
    expect((await request(srv()).get(`/frota/caminhoes/${id}`).set('Cookie', adminCookies)).status).toBe(404);
    expect((await request(srv()).post(`/frota/caminhoes/${id}/restaurar`).set('Cookie', adminCookies)).status).toBe(201);
  });

  it('motorista: ciclo CRUD, documento duplicado e caminhao padrao', async () => {
    const caminhao = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'DEF-2E34' });
    const criar = await request(srv()).post('/frota/motoristas').set('Cookie', adminCookies)
      .send({ nome: 'Carlos Souza', documento: 'CNH 123', telefone: '(11) 98811-0011', caminhaoPadraoId: caminhao.body.id });
    expect(criar.status).toBe(201);

    const dup = await request(srv()).post('/frota/motoristas').set('Cookie', adminCookies)
      .send({ nome: 'Outro', documento: 'CNH 123' });
    expect(dup.status).toBe(409);

    const lista = await request(srv()).get('/frota/motoristas').set('Cookie', adminCookies);
    expect(lista.body.data[0].caminhaoPadraoPlaca).toBe('DEF-2E34');

    const semCaminhao = await request(srv())
      .patch(`/frota/motoristas/${criar.body.id}`).set('Cookie', adminCookies)
      .send({ caminhaoPadraoId: null });
    expect(semCaminhao.status).toBe(200);
    expect(semCaminhao.body.caminhaoPadraoId).toBeNull();
  });

  it('frota respeita RBAC de leitura e escrita', async () => {
    expect((await request(srv()).get('/frota/caminhoes').set('Cookie', comercialCookies)).status).toBe(403);
    expect((await request(srv()).post('/frota/caminhoes').set('Cookie', comercialCookies)
      .send({ placa: 'XYZ-9Z99' })).status).toBe(403);
    expect((await request(srv()).get('/frota/motoristas').set('Cookie', comercialCookies)).status).toBe(403);
  });

  it('frota audita insert, update e delete', async () => {
    const criar = await request(srv()).post('/frota/caminhoes').set('Cookie', adminCookies)
      .send({ placa: 'GHI-3F45' });
    const id = criar.body.id as string;
    await request(srv()).patch(`/frota/caminhoes/${id}`).set('Cookie', adminCookies).send({ descricao: 'x' });
    await request(srv()).delete(`/frota/caminhoes/${id}`).set('Cookie', adminCookies);

    const log = await request(srv())
      .get(`/auditoria?tabela=frota_caminhoes&registroId=${id}`).set('Cookie', adminCookies);
    expect(log.status).toBe(200);
    expect(log.body.data.map((l: { operacao: string }) => l.operacao).sort())
      .toEqual(['DELETE', 'INSERT', 'UPDATE']);
  });
});
