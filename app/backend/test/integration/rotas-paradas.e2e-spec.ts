import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('Rotas — paradas e dias de atendimento', () => {
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

  it('rota persiste paradas ordenadas e dias validos', async () => {
    const criar = await request(srv()).post('/rotas').set('Cookie', adminCookies).send({
      codigo: 'L1',
      nome: 'Rota L1 · Centro',
      regiao: 'Centro',
      paradas: [
        { ordem: 2, descricao: 'Jardim Paulista' },
        { ordem: 1, descricao: 'Centro' },
        { ordem: 3, descricao: 'Bela Vista' },
      ],
      diasAtendimento: ['sex', 'seg', 'seg'],
    });
    expect(criar.status).toBe(201);
    expect(criar.body.paradas).toEqual([
      { ordem: 1, descricao: 'Centro' },
      { ordem: 2, descricao: 'Jardim Paulista' },
      { ordem: 3, descricao: 'Bela Vista' },
    ]);
    expect(criar.body.diasAtendimento).toEqual(['seg', 'sex']);

    const invalido = await request(srv()).post('/rotas').set('Cookie', adminCookies)
      .send({ codigo: 'L2', nome: 'X', diasAtendimento: ['segunda'] });
    expect(invalido.status).toBe(400);
  });

  it('reordenacao de paradas preserva descricoes', async () => {
    const criar = await request(srv()).post('/rotas').set('Cookie', adminCookies).send({
      codigo: 'SUL', nome: 'Rota Sul',
      paradas: [
        { ordem: 1, descricao: 'Santo Amaro' },
        { ordem: 2, descricao: 'Moema' },
        { ordem: 3, descricao: 'Brooklin' },
      ],
    });
    const editar = await request(srv()).patch(`/rotas/${criar.body.id}`).set('Cookie', adminCookies)
      .send({
        paradas: [
          { ordem: 1, descricao: 'Brooklin' },
          { ordem: 2, descricao: 'Santo Amaro' },
          { ordem: 3, descricao: 'Moema' },
        ],
      });
    expect(editar.status).toBe(200);
    expect(editar.body.paradas.map((p: { descricao: string }) => p.descricao))
      .toEqual(['Brooklin', 'Santo Amaro', 'Moema']);
  });
});
