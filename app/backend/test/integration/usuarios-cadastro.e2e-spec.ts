import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('Usuários e2e — administração completa (editar, soft delete, restore, perfis)', () => {
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

  const novoUsuario = (over: Record<string, unknown> = {}) => ({
    nome: 'Usuário Teste',
    email: `u-${Math.round(performance.now() * 1000)}@test.local`,
    password: 'Senha@1234567',
    ...over,
  });

  it('cria, edita, define perfis, soft-delete e restaura usuário', async () => {
    const criar = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookies)
      .send(novoUsuario());
    expect(criar.status).toBe(201);
    const id = criar.body.id;
    expect(criar.body).not.toHaveProperty('senhaHash');

    const editar = await request(app.getHttpServer())
      .patch(`/usuarios/${id}`)
      .set('Cookie', adminCookies)
      .send({ nome: 'Nome Editado', ativo: false });
    expect(editar.status).toBe(200);
    expect(editar.body.nome).toBe('Nome Editado');
    expect(editar.body.ativo).toBe(false);

    const definirPerfis = await request(app.getHttpServer())
      .put(`/usuarios/${id}/perfis`)
      .set('Cookie', adminCookies)
      .send({ perfis: ['comercial', 'compras'] });
    expect(definirPerfis.status).toBe(200);
    expect(definirPerfis.body.perfis).toEqual(expect.arrayContaining(['comercial', 'compras']));

    const detalhar = await request(app.getHttpServer()).get(`/usuarios/${id}`).set('Cookie', adminCookies);
    expect(detalhar.status).toBe(200);
    expect(detalhar.body.perfis).toEqual(expect.arrayContaining(['comercial', 'compras']));

    const remover = await request(app.getHttpServer()).delete(`/usuarios/${id}`).set('Cookie', adminCookies);
    expect(remover.status).toBe(200);
    const aposRemover = await request(app.getHttpServer()).get(`/usuarios/${id}`).set('Cookie', adminCookies);
    expect(aposRemover.status).toBe(404);

    const restaurar = await request(app.getHttpServer())
      .post(`/usuarios/${id}/restaurar`)
      .set('Cookie', adminCookies);
    expect(restaurar.status).toBe(201);
  });

  it('rejeita perfis inexistentes ao definir perfis', async () => {
    const criar = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookies)
      .send(novoUsuario());
    const res = await request(app.getHttpServer())
      .put(`/usuarios/${criar.body.id}/perfis`)
      .set('Cookie', adminCookies)
      .send({ perfis: ['perfil_que_nao_existe'] });
    expect(res.status).toBe(409);
  });

  it('email duplicado ao criar → 409', async () => {
    const email = `dup-${Math.round(performance.now() * 1000)}@test.local`;
    await request(app.getHttpServer()).post('/usuarios').set('Cookie', adminCookies).send(novoUsuario({ email }));
    const dup = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookies)
      .send(novoUsuario({ email }));
    expect(dup.status).toBe(409);
  });

  it('cria já com perfis e troca de email na edição (cobre colisão de email)', async () => {
    const criar = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookies)
      .send(novoUsuario({ perfis: ['comercial'] }));
    expect(criar.status).toBe(201);

    const novoEmail = `edit-${Math.round(performance.now() * 1000)}@test.local`;
    const editar = await request(app.getHttpServer())
      .patch(`/usuarios/${criar.body.id}`)
      .set('Cookie', adminCookies)
      .send({ email: novoEmail });
    expect(editar.status).toBe(200);
    expect(editar.body.email).toBe(novoEmail);

    // Tentar trocar para um email já usado por outro usuário → 409.
    const outro = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookies)
      .send(novoUsuario());
    const colisao = await request(app.getHttpServer())
      .patch(`/usuarios/${outro.body.id}`)
      .set('Cookie', adminCookies)
      .send({ email: novoEmail });
    expect(colisao.status).toBe(409);
  });

  it('restaurar usuário não removido → 409; editar/remover/restaurar inexistente → 404', async () => {
    const criar = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookies)
      .send(novoUsuario());
    const restaurarAtivo = await request(app.getHttpServer())
      .post(`/usuarios/${criar.body.id}/restaurar`)
      .set('Cookie', adminCookies);
    expect(restaurarAtivo.status).toBe(409);

    const inex = '019e9e00-0000-7000-8000-000000000999';
    expect(
      (await request(app.getHttpServer()).delete(`/usuarios/${inex}`).set('Cookie', adminCookies)).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).post(`/usuarios/${inex}/restaurar`).set('Cookie', adminCookies)).status,
    ).toBe(404);
  });
});
