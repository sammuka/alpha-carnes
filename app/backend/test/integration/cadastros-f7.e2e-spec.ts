import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('Cadastros F7 e2e (produtos, rotas, representantes)', () => {
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

  describe('Produtos', () => {
    it('admin cria, edita, remove e restaura produto; comercial só lê', async () => {
      const criar = await request(srv())
        .post('/produtos')
        .set('Cookie', adminCookies)
        .send({
          codigo: 'PROD-F7-1',
          nome: 'Traseiro inteiro',
          unidadePedido: 'peca',
          passaBalanca: true,
          saidaTransformacao: true,
        });
      expect(criar.status).toBe(201);
      const id = criar.body.id as string;

      const negado = await request(srv())
        .post('/produtos')
        .set('Cookie', comercialCookies)
        .send({ codigo: 'PROD-X', nome: 'X', unidadePedido: 'peca' });
      expect(negado.status).toBe(403);

      const editar = await request(srv())
        .patch(`/produtos/${id}`)
        .set('Cookie', adminCookies)
        .send({ nome: 'Traseiro editado', status: 'inativo', tipoOperacional: 'derivado_desossa' });
      expect(editar.status).toBe(200);
      expect(editar.body.nome).toBe('Traseiro editado');

      const lista = await request(srv()).get('/produtos?search=Traseiro').set('Cookie', adminCookies);
      expect(lista.status).toBe(200);
      expect(lista.body.data.some((p: { id: string }) => p.id === id)).toBe(true);

      expect((await request(srv()).delete(`/produtos/${id}`).set('Cookie', adminCookies)).status).toBe(200);
      expect((await request(srv()).get(`/produtos/${id}`).set('Cookie', adminCookies)).status).toBe(404);
      expect((await request(srv()).post(`/produtos/${id}/restaurar`).set('Cookie', adminCookies)).status).toBe(201);
    });

    it('código duplicado → 409; detalhe inexistente → 404', async () => {
      await request(srv())
        .post('/produtos')
        .set('Cookie', adminCookies)
        .send({ codigo: 'PROD-DUP', nome: 'A', unidadePedido: 'peca' });
      const dup = await request(srv())
        .post('/produtos')
        .set('Cookie', adminCookies)
        .send({ codigo: 'PROD-DUP', nome: 'B', unidadePedido: 'peca' });
      expect(dup.status).toBe(409);

      const det = await request(srv())
        .get('/produtos/019e9e00-0000-7000-8000-000000000999')
        .set('Cookie', adminCookies);
      expect(det.status).toBe(404);
    });
  });

  describe('Rotas', () => {
    it('ciclo CRUD completo', async () => {
      const criar = await request(srv())
        .post('/rotas')
        .set('Cookie', adminCookies)
        .send({ codigo: 'ROTA-1', nome: 'Osasco Norte', regiao: 'Osasco' });
      expect(criar.status).toBe(201);
      const id = criar.body.id as string;

      const editar = await request(srv())
        .patch(`/rotas/${id}`)
        .set('Cookie', adminCookies)
        .send({ nome: 'Osasco Norte A', motoristaPadrao: 'João', status: 'inativo' });
      expect(editar.status).toBe(200);

      const busca = await request(srv()).get('/rotas?search=Osasco').set('Cookie', adminCookies);
      expect(busca.status).toBe(200);

      await request(srv()).delete(`/rotas/${id}`).set('Cookie', adminCookies);
      expect((await request(srv()).post(`/rotas/${id}/restaurar`).set('Cookie', adminCookies)).status).toBe(201);
    });

    it('404 ao editar inexistente; 409 ao restaurar rota ativa', async () => {
      expect(
        (await request(srv())
          .patch('/rotas/019e9e00-0000-7000-8000-000000000999')
          .set('Cookie', adminCookies)
          .send({ nome: 'X' })).status,
      ).toBe(404);

      const criar = await request(srv())
        .post('/rotas')
        .set('Cookie', adminCookies)
        .send({ codigo: 'ROTA-ATIVA', nome: 'Ativa', regiao: 'SP' });
      expect(criar.status).toBe(201);

      const conflito = await request(srv())
        .post(`/rotas/${criar.body.id}/restaurar`)
        .set('Cookie', adminCookies);
      expect(conflito.status).toBe(409);
    });

    it('409 código duplicado ao criar rota', async () => {
      await request(srv())
        .post('/rotas')
        .set('Cookie', adminCookies)
        .send({ codigo: 'ROTA-DUP', nome: 'A', regiao: 'SP' });
      expect(
        (
          await request(srv())
            .post('/rotas')
            .set('Cookie', adminCookies)
            .send({ codigo: 'ROTA-DUP', nome: 'B', regiao: 'SP' })
        ).status,
      ).toBe(409);
    });
  });

  describe('Representantes', () => {
    it('ciclo CRUD completo', async () => {
      const criar = await request(srv())
        .post('/representantes')
        .set('Cookie', adminCookies)
        .send({ codigo: 'REP-1', nome: 'Carlos Silva', tipoCanal: 'atacado' });
      expect(criar.status).toBe(201);
      const id = criar.body.id as string;

      const editar = await request(srv())
        .patch(`/representantes/${id}`)
        .set('Cookie', adminCookies)
        .send({ contato: '11 99999-0000', observacao: 'zona leste' });
      expect(editar.status).toBe(200);

      const busca = await request(srv()).get('/representantes?search=Carlos').set('Cookie', adminCookies);
      expect(busca.status).toBe(200);

      await request(srv()).delete(`/representantes/${id}`).set('Cookie', adminCookies);
      expect((await request(srv()).post(`/representantes/${id}/restaurar`).set('Cookie', adminCookies)).status).toBe(201);
    });

    it('404 detalhe; 409 código duplicado e restaurar ativo', async () => {
      expect(
        (await request(srv()).get('/representantes/019e9e00-0000-7000-8000-000000000999').set('Cookie', adminCookies))
          .status,
      ).toBe(404);

      await request(srv())
        .post('/representantes')
        .set('Cookie', adminCookies)
        .send({ codigo: 'REP-DUP', nome: 'A', tipoCanal: 'atacado' });
      expect(
        (
          await request(srv())
            .post('/representantes')
            .set('Cookie', adminCookies)
            .send({ codigo: 'REP-DUP', nome: 'B', tipoCanal: 'varejo' })
        ).status,
      ).toBe(409);

      const criar = await request(srv())
        .post('/representantes')
        .set('Cookie', adminCookies)
        .send({ codigo: 'REP-ATIVO', nome: 'Ativo', tipoCanal: 'atacado' });
      expect(
        (await request(srv()).post(`/representantes/${criar.body.id}/restaurar`).set('Cookie', adminCookies)).status,
      ).toBe(409);
    });
  });
});
