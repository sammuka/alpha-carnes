import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

describe('Regras de desdobramento e2e (fator>0, vigência, itens ativos, sobreposição)', () => {
  let app: INestApplication;
  let adminCookies: string;
  let comercialCookies: string;
  let produtoOrigemId: string;
  let produtoDestinoId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);

    const produtoCompra = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminCookies)
      .send({
        codigo: 'IC-BOI',
        nome: 'Boi',
        unidadePedido: 'unidade',
        tipoOperacional: 'compra_base',
        ativoCompra: true,
        ativoVenda: false,
      });
    produtoOrigemId = produtoCompra.body.id;

    const produtoVenda = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminCookies)
      .send({
        codigo: 'ICM-DIANT',
        nome: 'Dianteiro',
        unidadePedido: 'kg',
        ativoCompra: true,
        ativoVenda: true,
      });
    produtoDestinoId = produtoVenda.body.id;
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const novaRegra = (over: Record<string, unknown> = {}) => ({
    produtoOrigemId,
    produtoDestinoId,
    fatorQuantidade: 1.5,
    vigenciaInicio: '2026-01-01T00:00:00.000Z',
    vigenciaFim: '2026-06-30T00:00:00.000Z',
    ...over,
  });

  describe('RBAC', () => {
    it('comercial sem GERENCIAR — gestor/admin gerencia; comercial só lê', async () => {
      const lista = await request(app.getHttpServer())
        .get('/regras-desdobramento')
        .set('Cookie', comercialCookies);
      expect(lista.status).toBe(200);

      const criar = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', comercialCookies)
        .send(novaRegra());
      expect(criar.status).toBe(403);
    });
  });

  describe('Invariantes de negócio', () => {
    it('rejeita fatorQuantidade <= 0 com 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send(novaRegra({ fatorQuantidade: 0 }));
      expect(res.status).toBe(400);
    });

    it('rejeita vigenciaFim anterior a vigenciaInicio com 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send(novaRegra({ vigenciaInicio: '2026-06-01T00:00:00.000Z', vigenciaFim: '2026-01-01T00:00:00.000Z' }));
      expect(res.status).toBe(400);
    });

    it('rejeita item de compra inexistente/inativo com 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send(novaRegra({ produtoOrigemId: '019e9e00-0000-7000-8000-000000000999' }));
      expect(res.status).toBe(400);
    });

    it('cria regra válida (201) e bloqueia segunda regra ativa com vigência sobreposta (409)', async () => {
      const primeira = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send(novaRegra({ vigenciaInicio: '2026-01-01T00:00:00.000Z', vigenciaFim: '2026-06-30T00:00:00.000Z' }));
      expect(primeira.status).toBe(201);

      // Sobreposição real: [2026-03-01, 2026-09-30) cruza [2026-01-01, 2026-06-30).
      const sobreposta = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send(novaRegra({ vigenciaInicio: '2026-03-01T00:00:00.000Z', vigenciaFim: '2026-09-30T00:00:00.000Z' }));
      expect(sobreposta.status).toBe(409);
    });

    it('permite segunda regra ativa em período NÃO sobreposto', async () => {
      // Período disjunto do anterior: [2026-07-01, 2026-12-31).
      const res = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send(novaRegra({ vigenciaInicio: '2026-07-01T00:00:00.000Z', vigenciaFim: '2026-12-31T00:00:00.000Z' }));
      expect(res.status).toBe(201);
    });

    it('lista incluindo removidos quando incluirRemovidos=true', async () => {
      const res = await request(app.getHttpServer())
        .get('/regras-desdobramento?incluirRemovidos=true')
        .set('Cookie', adminCookies);
      expect(res.status).toBe(200);
    });

    it('atualiza apenas o status sem mexer em vigência/itens (ramos de fallback)', async () => {
      const ic = await request(app.getHttpServer())
        .post('/produtos').set('Cookie', adminCookies).send({ codigo: uid('IC-PARTIAL'), nome: 'B', unidadePedido: 'unidade', ativoCompra: true, ativoVenda: false });
      const icm = await request(app.getHttpServer())
        .post('/produtos')
        .set('Cookie', adminCookies)
        .send({ codigo: uid('ICM-PARTIAL'), nome: 'T', unidadePedido: 'kg', ativoCompra: true, ativoVenda: true });
      // Criação mínima: sem vigenciaFim e sem observacoes (cobre ramos de default).
      const criar = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send({
          produtoOrigemId: ic.body.id,
          produtoDestinoId: icm.body.id,
          fatorQuantidade: 1,
          vigenciaInicio: '2026-01-01T00:00:00.000Z',
        });
      expect(criar.status).toBe(201);

      const editar = await request(app.getHttpServer())
        .patch(`/regras-desdobramento/${criar.body.id}`)
        .set('Cookie', adminCookies)
        .send({ observacoes: 'só observação' });
      expect(editar.status).toBe(200);
      expect(editar.body.observacoes).toBe('só observação');
    });

    it('ciclo completo: detalhar, editar, soft-delete, restore e 404', async () => {
      // Par de itens isolado.
      const ic = await request(app.getHttpServer())
        .post('/produtos').set('Cookie', adminCookies).send({ codigo: uid('IC-LIFE'), nome: 'B', unidadePedido: 'unidade', ativoCompra: true, ativoVenda: false });
      const icm = await request(app.getHttpServer())
        .post('/produtos')
        .set('Cookie', adminCookies)
        .send({ codigo: uid('ICM-LIFE-R'), nome: 'Traseiro L', unidadePedido: 'kg', ativoCompra: true, ativoVenda: true });

      const criar = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send({
          produtoOrigemId: ic.body.id,
          produtoDestinoId: icm.body.id,
          fatorQuantidade: 1.2,
          vigenciaInicio: '2026-01-01T00:00:00.000Z',
          vigenciaFim: '2026-06-30T00:00:00.000Z',
        });
      expect(criar.status).toBe(201);
      const id = criar.body.id;

      const detalhar = await request(app.getHttpServer())
        .get(`/regras-desdobramento/${id}`)
        .set('Cookie', adminCookies);
      expect(detalhar.status).toBe(200);
      expect((await request(app.getHttpServer()).get('/regras-desdobramento').set('Cookie', adminCookies)).status).toBe(
        200,
      );

      // Editar o fator e a vigência.
      const editar = await request(app.getHttpServer())
        .patch(`/regras-desdobramento/${id}`)
        .set('Cookie', adminCookies)
        .send({ fatorQuantidade: 2.5, vigenciaFim: '2026-12-31T00:00:00.000Z' });
      expect(editar.status).toBe(200);
      expect(Number(editar.body.fatorQuantidade)).toBe(2.5);

      // Inativar via update remove a restrição de sobreposição para esse par.
      const inativar = await request(app.getHttpServer())
        .patch(`/regras-desdobramento/${id}`)
        .set('Cookie', adminCookies)
        .send({ status: 'inativo' });
      expect(inativar.status).toBe(200);

      const remover = await request(app.getHttpServer())
        .delete(`/regras-desdobramento/${id}`)
        .set('Cookie', adminCookies);
      expect(remover.status).toBe(200);
      expect(
        (await request(app.getHttpServer()).get(`/regras-desdobramento/${id}`).set('Cookie', adminCookies)).status,
      ).toBe(404);

      const restaurar = await request(app.getHttpServer())
        .post(`/regras-desdobramento/${id}/restaurar`)
        .set('Cookie', adminCookies);
      expect(restaurar.status).toBe(201);
    });

    it('vigência aberta (fim NULL) sobrepõe qualquer período posterior ao início', async () => {
      // Cria par novo de itens para isolar este cenário.
      const ic = await request(app.getHttpServer())
        .post('/produtos').set('Cookie', adminCookies).send({ codigo: uid('IC-VIG'), nome: 'B', unidadePedido: 'unidade', ativoCompra: true, ativoVenda: false });
      const icm = await request(app.getHttpServer())
        .post('/produtos')
        .set('Cookie', adminCookies)
        .send({ codigo: uid('ICM-PERNIL'), nome: 'Pernil', unidadePedido: 'kg', ativoCompra: true, ativoVenda: true });

      const aberta = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send({
          produtoOrigemId: ic.body.id,
          produtoDestinoId: icm.body.id,
          fatorQuantidade: 2,
          vigenciaInicio: '2026-01-01T00:00:00.000Z',
          vigenciaFim: null,
        });
      expect(aberta.status).toBe(201);

      const conflito = await request(app.getHttpServer())
        .post('/regras-desdobramento')
        .set('Cookie', adminCookies)
        .send({
          produtoOrigemId: ic.body.id,
          produtoDestinoId: icm.body.id,
          fatorQuantidade: 3,
          vigenciaInicio: '2027-05-01T00:00:00.000Z',
          vigenciaFim: '2027-08-01T00:00:00.000Z',
        });
      expect(conflito.status).toBe(409);
    });
  });
});
