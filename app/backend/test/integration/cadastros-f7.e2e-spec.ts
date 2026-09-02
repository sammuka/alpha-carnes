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
          unidadePedido: 'unidade',
          passaBalanca: true,
          saidaTransformacao: true,
        });
      expect(criar.status).toBe(201);
      const id = criar.body.id as string;

      const negado = await request(srv())
        .post('/produtos')
        .set('Cookie', comercialCookies)
        .send({ codigo: 'PROD-X', nome: 'X', unidadePedido: 'unidade' });
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
        .send({ codigo: 'PROD-DUP', nome: 'A', unidadePedido: 'unidade' });
      const dup = await request(srv())
        .post('/produtos')
        .set('Cookie', adminCookies)
        .send({ codigo: 'PROD-DUP', nome: 'B', unidadePedido: 'unidade' });
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

  describe('Produtos', () => {
    it('produto persiste bloco fiscal em atributos_json', async () => {
      const criar = await request(srv()).post('/produtos').set('Cookie', adminCookies).send({
        codigo: 'PRD-FISCAL',
        nome: 'Coxão mole',
        tipoOperacional: 'peca_inteira_pesavel',
        unidadePedido: 'unidade',
        unidadePreco: 'kg',
        atributosJson: { fiscal: { ncm: '0201.30.00', cfop: '5102' } },
      });
      expect(criar.status).toBe(201);

      const detalhe = await request(srv()).get(`/produtos/${criar.body.id}`).set('Cookie', adminCookies);
      expect(detalhe.body.atributosJson.fiscal).toEqual({ ncm: '0201.30.00', cfop: '5102' });
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

    it('DoD-82: filtra por status e tipoCanal; /canais devolve canais reais sem nulos', async () => {
      const repDistribuidor = await request(srv())
        .post('/representantes')
        .set('Cookie', adminCookies)
        .send({ codigo: 'REP-DOD82-DISTRIB', nome: 'Representante Distribuidor', tipoCanal: 'distribuidor' });
      expect(repDistribuidor.status).toBe(201);

      const repIndustria = await request(srv())
        .post('/representantes')
        .set('Cookie', adminCookies)
        .send({ codigo: 'REP-DOD82-INDUSTRIA', nome: 'Representante Indústria', tipoCanal: 'industria' });
      expect(repIndustria.status).toBe(201);

      const inativar = await request(srv())
        .patch(`/representantes/${repIndustria.body.id}`)
        .set('Cookie', adminCookies)
        .send({ status: 'inativo' });
      expect(inativar.status).toBe(200);

      const porCanal = await request(srv())
        .get('/representantes?tipoCanal=distribuidor')
        .set('Cookie', adminCookies);
      expect(porCanal.status).toBe(200);
      expect(porCanal.body.data.length).toBeGreaterThan(0);
      expect(porCanal.body.data.every((r: { tipoCanal: string }) => r.tipoCanal === 'distribuidor')).toBe(true);
      expect(porCanal.body.data.some((r: { id: string }) => r.id === repDistribuidor.body.id)).toBe(true);
      expect(porCanal.body.data.some((r: { id: string }) => r.id === repIndustria.body.id)).toBe(false);

      const porStatus = await request(srv()).get('/representantes?status=inativo').set('Cookie', adminCookies);
      expect(porStatus.status).toBe(200);
      expect(porStatus.body.data.length).toBeGreaterThan(0);
      expect(porStatus.body.data.every((r: { status: string }) => r.status === 'inativo')).toBe(true);
      expect(porStatus.body.data.some((r: { id: string }) => r.id === repIndustria.body.id)).toBe(true);
      expect(porStatus.body.data.some((r: { id: string }) => r.id === repDistribuidor.body.id)).toBe(false);

      const canais = await request(srv()).get('/representantes/canais').set('Cookie', adminCookies);
      expect(canais.status).toBe(200);
      expect(canais.body).toContain('distribuidor');
      expect(canais.body).toContain('industria');
      expect(canais.body.every((c: unknown) => typeof c === 'string' && c.length > 0)).toBe(true);
    });

    it('DoD-83: clientesVinculados na listagem e no detalhe vem de clientes.representante_id, não de mock', async () => {
      const representante = await request(srv())
        .post('/representantes')
        .set('Cookie', adminCookies)
        .send({ codigo: 'REP-DOD83', nome: 'Representante Vinculado', tipoCanal: 'varejo' });
      expect(representante.status).toBe(201);
      const representanteId = representante.body.id as string;

      const semVinculo = await request(srv())
        .get(`/representantes/${representanteId}`)
        .set('Cookie', adminCookies);
      expect(semVinculo.body.clientesVinculados).toEqual([]);

      const cliente = await request(srv())
        .post('/clientes')
        .set('Cookie', adminCookies)
        .send({
          codigo: 'CLI-DOD83',
          razaoSocial: 'Cliente Vinculado DoD83 LTDA',
          documentoFiscal: '11222333000181',
          representanteId,
        });
      expect(cliente.status).toBe(201);

      const lista = await request(srv())
        .get(`/representantes?tipoCanal=varejo`)
        .set('Cookie', adminCookies);
      const naLista = lista.body.data.find((r: { id: string }) => r.id === representanteId);
      expect(naLista).toBeDefined();
      expect(naLista.clientesVinculados).toBe(1);

      const detalheComVinculo = await request(srv())
        .get(`/representantes/${representanteId}`)
        .set('Cookie', adminCookies);
      expect(detalheComVinculo.body.clientesVinculados).toEqual([
        { id: cliente.body.id, nomeFantasia: null, razaoSocial: 'Cliente Vinculado DoD83 LTDA' },
      ]);

      // Remove o vínculo (soft delete do cliente) e confere que a contagem cai — prova que
      // vem de uma consulta real ao banco, não de um valor fixo.
      await request(srv()).delete(`/clientes/${cliente.body.id}`).set('Cookie', adminCookies);

      const listaSemVinculo = await request(srv())
        .get(`/representantes?tipoCanal=varejo`)
        .set('Cookie', adminCookies);
      const naListaDepois = listaSemVinculo.body.data.find((r: { id: string }) => r.id === representanteId);
      expect(naListaDepois.clientesVinculados).toBe(0);

      const detalheSemVinculo = await request(srv())
        .get(`/representantes/${representanteId}`)
        .set('Cookie', adminCookies);
      expect(detalheSemVinculo.body.clientesVinculados).toEqual([]);
    });
  });
});
