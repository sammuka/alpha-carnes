import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('Desossa e estoque e2e', () => {
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

  it('GET /estoque/consulta retorna lista (pode ser vazia)', async () => {
    const res = await request(srv()).get('/estoque/consulta').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /desossa/faltas retorna lista (pode ser vazia)', async () => {
    const res = await request(srv()).get('/desossa/faltas').set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('regras de transformação: CRUD básico', async () => {
    const prodOrigem = await request(srv())
      .post('/produtos')
      .set('Cookie', adminCookies)
      .send({ codigo: 'TZ-F7', nome: 'Traseiro origem', unidadePedido: 'peca', origemTransformacao: true });
    expect(prodOrigem.status).toBe(201);

    const prodSaida = await request(srv())
      .post('/produtos')
      .set('Cookie', adminCookies)
      .send({ codigo: 'PA-F7', nome: 'Patinho', unidadePedido: 'peca', saidaTransformacao: true });
    expect(prodSaida.status).toBe(201);

    const criar = await request(srv())
      .post('/desossa/regras-transformacao')
      .set('Cookie', adminCookies)
      .send({
        nome: 'Traseiro → Patinho',
        produtoOrigemCodigo: 'TZ-F7',
        saidas: [{ produtoId: prodSaida.body.id, quantidadeFixa: 2 }],
      });
    expect(criar.status).toBe(201);
    const id = criar.body.id as string;
    expect(criar.body.saidas).toHaveLength(1);

    const detalhe = await request(srv()).get(`/desossa/regras-transformacao/${id}`).set('Cookie', adminCookies);
    expect(detalhe.status).toBe(200);

    const lista = await request(srv()).get('/desossa/regras-transformacao').set('Cookie', adminCookies);
    expect(lista.status).toBe(200);

    const editar = await request(srv())
      .patch(`/desossa/regras-transformacao/${id}`)
      .set('Cookie', adminCookies)
      .send({ observacao: 'regra teste', prioridade: 5 });
    expect(editar.status).toBe(200);

    await request(srv()).delete(`/desossa/regras-transformacao/${id}`).set('Cookie', adminCookies);
    expect((await request(srv()).post(`/desossa/regras-transformacao/${id}/restaurar`).set('Cookie', adminCookies)).status).toBe(201);
  });

  it('detalhe regra inexistente → 404', async () => {
    const res = await request(srv())
      .get('/desossa/regras-transformacao/019e9e00-0000-7000-8000-000000000999')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(404);
  });

  it('409 ao restaurar regra ativa; 400 produto saída inválido', async () => {
    const prodSaida = await request(srv())
      .post('/produtos')
      .set('Cookie', adminCookies)
      .send({ codigo: 'PA-REST', nome: 'Patinho', unidadePedido: 'peca', saidaTransformacao: true });
    expect(prodSaida.status).toBe(201);

    const criar = await request(srv())
      .post('/desossa/regras-transformacao')
      .set('Cookie', adminCookies)
      .send({
        nome: 'Regra ativa',
        produtoOrigemCodigo: 'TZ',
        saidas: [{ produtoId: prodSaida.body.id, quantidadeFixa: 1 }],
      });
    expect(criar.status).toBe(201);
    expect(
      (await request(srv()).post(`/desossa/regras-transformacao/${criar.body.id}/restaurar`).set('Cookie', adminCookies))
        .status,
    ).toBe(409);

    expect(
      (
        await request(srv())
          .post('/desossa/regras-transformacao')
          .set('Cookie', adminCookies)
          .send({
            nome: 'Saída inválida',
            saidas: [{ produtoId: '019e9e00-0000-7000-8000-000000000999', quantidadeFixa: 1 }],
          })
      ).status,
    ).toBeGreaterThanOrEqual(400);
  });
});
