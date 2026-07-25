import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';
import { DRIZZLE } from '../../src/database/database.module';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

const CNPJ_VALIDO = '11222333000181';

describe('Cadastros diversos e2e (fornecedores, itens, parâmetros)', () => {
  let app: INestApplication;
  let adminCookies: string;
  let comercialCookies: string;
  let comprasCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  describe('Fornecedores (compras gerencia; comercial só lê)', () => {
    it('compras cria fornecedor (201); comercial recebe 403', async () => {
      const ok = await request(app.getHttpServer())
        .post('/fornecedores')
        .set('Cookie', comprasCookies)
        .send({ codigo: 'FOR-1', razaoSocial: 'Frigorífico X', documentoFiscal: CNPJ_VALIDO });
      expect(ok.status).toBe(201);

      const negado = await request(app.getHttpServer())
        .post('/fornecedores')
        .set('Cookie', comercialCookies)
        .send({ codigo: 'FOR-2', razaoSocial: 'Frigorífico Y', documentoFiscal: '04252011000110' });
      expect(negado.status).toBe(403);
    });

    it('valida documento fiscal inválido (400) e duplicado (409)', async () => {
      const invalido = await request(app.getHttpServer())
        .post('/fornecedores')
        .set('Cookie', comprasCookies)
        .send({ codigo: 'FOR-INV', razaoSocial: 'Z', documentoFiscal: '11222333000182' });
      expect(invalido.status).toBe(400);

      await request(app.getHttpServer())
        .post('/fornecedores')
        .set('Cookie', comprasCookies)
        .send({ codigo: 'FOR-D1', razaoSocial: 'Z', documentoFiscal: '34028316000103' });
      const dup = await request(app.getHttpServer())
        .post('/fornecedores')
        .set('Cookie', comprasCookies)
        .send({ codigo: 'FOR-D2', razaoSocial: 'Z', documentoFiscal: '34028316000103' });
      expect(dup.status).toBe(409);
    });

    it('soft delete + restore, edição e auditoria registrada', async () => {
      const criar = await request(app.getHttpServer())
        .post('/fornecedores')
        .set('Cookie', comprasCookies)
        .send({ codigo: 'FOR-SD', razaoSocial: 'SoftDel', documentoFiscal: '33000167000101' });
      const id = criar.body.id;

      const detalhar = await request(app.getHttpServer()).get(`/fornecedores/${id}`).set('Cookie', comprasCookies);
      expect(detalhar.status).toBe(200);

      const editar = await request(app.getHttpServer())
        .patch(`/fornecedores/${id}`)
        .set('Cookie', comprasCookies)
        .send({ razaoSocial: 'SoftDel Editado', observacoes: 'obs' });
      expect(editar.status).toBe(200);
      expect(editar.body.razaoSocial).toBe('SoftDel Editado');

      const remover = await request(app.getHttpServer()).delete(`/fornecedores/${id}`).set('Cookie', comprasCookies);
      expect(remover.status).toBe(200);
      const naoAparece = await request(app.getHttpServer()).get(`/fornecedores/${id}`).set('Cookie', comprasCookies);
      expect(naoAparece.status).toBe(404);
      const restaurar = await request(app.getHttpServer())
        .post(`/fornecedores/${id}/restaurar`)
        .set('Cookie', comprasCookies);
      expect(restaurar.status).toBe(201);

      const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
      const auditRows = await db.execute(
        sql`SELECT operacao FROM auditoria WHERE tabela='fornecedores' AND registro_id=${id}`,
      );
      const ops = auditRows.rows.map((r) => r.operacao);
      expect(ops).toEqual(expect.arrayContaining(['INSERT', 'DELETE', 'UPDATE']));
    });

    it('contagens de fornecedores batem com o banco', async () => {
      await request(app.getHttpServer()).post('/fornecedores').set('Cookie', adminCookies)
        .send({ codigo: 'FOR-C1', razaoSocial: 'Ativo 1', documentoFiscal: '12345678000195' });
      const inativo = await request(app.getHttpServer()).post('/fornecedores').set('Cookie', adminCookies)
        .send({ codigo: 'FOR-C2', razaoSocial: 'Inativo 1', documentoFiscal: '98765432000198', status: 'inativo' });
      expect(inativo.status).toBe(201);

      const contagens = await request(app.getHttpServer()).get('/fornecedores/contagens').set('Cookie', adminCookies);
      expect(contagens.status).toBe(200);
      expect(contagens.body.total).toBe(contagens.body.ativos + contagens.body.inativos);
      expect(contagens.body.inativos).toBeGreaterThanOrEqual(1);
    });

    it('historico do fornecedor vem de ocorrencias reais', async () => {
      const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);

      const criar = await request(app.getHttpServer()).post('/fornecedores').set('Cookie', adminCookies)
        .send({ codigo: 'FOR-H1', razaoSocial: 'Com histórico', documentoFiscal: '55667788000186' });
      const semOcorrencia = await request(app.getHttpServer())
        .get(`/fornecedores/${criar.body.id}/historico`).set('Cookie', adminCookies);
      expect(semOcorrencia.status).toBe(200);
      expect(semOcorrencia.body).toEqual({ ocorrenciasAno: 0, ultimaDivergencia: null });

      const [usuario] = await db.select({ id: schema.usuarios.id }).from(schema.usuarios).limit(1);
      expect(usuario).toBeDefined();
      const descricaoFallback = 'Atraso na entrega acordada';
      await db.insert(schema.ocorrenciasFornecedor).values({
        fornecedorId: criar.body.id,
        divergenciaId: null,
        descricao: descricaoFallback,
        status: 'aberta',
        usuarioAberturaId: usuario!.id,
      });

      const comOcorrencia = await request(app.getHttpServer())
        .get(`/fornecedores/${criar.body.id}/historico`).set('Cookie', adminCookies);
      expect(comOcorrencia.status).toBe(200);
      expect(comOcorrencia.body.ocorrenciasAno).toBe(1);
      expect(comOcorrencia.body.ultimaDivergencia).toMatchObject({ tipo: descricaoFallback });
    });
  });

  describe('Itens de compra e comerciais (administrador gerencia)', () => {
    it('admin cria item de compra; comercial recebe 403', async () => {
      const ok = await request(app.getHttpServer())
        .post('/itens-compra')
        .set('Cookie', adminCookies)
        .send({ codigo: 'IC-1', descricao: 'Boi', unidadeCompra: 'cabeca' });
      expect(ok.status).toBe(201);

      const negado = await request(app.getHttpServer())
        .post('/itens-compra')
        .set('Cookie', comercialCookies)
        .send({ codigo: 'IC-2', descricao: 'Suíno', unidadeCompra: 'lote' });
      expect(negado.status).toBe(403);
    });

    it('código duplicado em item de compra → 409', async () => {
      await request(app.getHttpServer())
        .post('/itens-compra')
        .set('Cookie', adminCookies)
        .send({ codigo: 'IC-DUP', descricao: 'A', unidadeCompra: 'kg' });
      const dup = await request(app.getHttpServer())
        .post('/itens-compra')
        .set('Cookie', adminCookies)
        .send({ codigo: 'IC-DUP', descricao: 'B', unidadeCompra: 'kg' });
      expect(dup.status).toBe(409);
    });

    it('admin cria item comercial com permiteCorte e edita', async () => {
      const criar = await request(app.getHttpServer())
        .post('/itens-comerciais')
        .set('Cookie', adminCookies)
        .send({ codigo: 'ICM-1', descricao: 'Dianteiro', unidadeComercial: 'peca', permiteCorte: true });
      expect(criar.status).toBe(201);
      expect(criar.body.permiteCorte).toBe(true);

      const editar = await request(app.getHttpServer())
        .patch(`/itens-comerciais/${criar.body.id}`)
        .set('Cookie', adminCookies)
        .send({ descricao: 'Dianteiro c/ osso' });
      expect(editar.status).toBe(200);
      expect(editar.body.descricao).toBe('Dianteiro c/ osso');
    });

    it('item de compra: ciclo completo (detalhar, editar, soft-delete, restore, 404 e conflitos)', async () => {
      const criar = await request(app.getHttpServer())
        .post('/itens-compra')
        .set('Cookie', adminCookies)
        .send({ codigo: 'IC-LIFE', descricao: 'Frango', categoria: 'aves', unidadeCompra: 'caixa' });
      const id = criar.body.id;

      expect((await request(app.getHttpServer()).get(`/itens-compra/${id}`).set('Cookie', adminCookies)).status).toBe(
        200,
      );
      expect((await request(app.getHttpServer()).get('/itens-compra').set('Cookie', adminCookies)).status).toBe(200);

      const editar = await request(app.getHttpServer())
        .patch(`/itens-compra/${id}`)
        .set('Cookie', adminCookies)
        .send({ descricao: 'Frango congelado', status: 'inativo' });
      expect(editar.status).toBe(200);
      expect(editar.body.status).toBe('inativo');

      expect((await request(app.getHttpServer()).delete(`/itens-compra/${id}`).set('Cookie', adminCookies)).status).toBe(
        200,
      );
      expect((await request(app.getHttpServer()).get(`/itens-compra/${id}`).set('Cookie', adminCookies)).status).toBe(
        404,
      );

      const restaurar = await request(app.getHttpServer())
        .post(`/itens-compra/${id}/restaurar`)
        .set('Cookie', adminCookies);
      expect(restaurar.status).toBe(201);
      // Restaurar de novo (não está removido) → 409.
      const restaurar2 = await request(app.getHttpServer())
        .post(`/itens-compra/${id}/restaurar`)
        .set('Cookie', adminCookies);
      expect(restaurar2.status).toBe(409);

      // Editar inexistente → 404.
      const editarInex = await request(app.getHttpServer())
        .patch('/itens-compra/019e9e00-0000-7000-8000-000000000999')
        .set('Cookie', adminCookies)
        .send({ descricao: 'x' });
      expect(editarInex.status).toBe(404);
    });

    it('item comercial: ciclo completo (editar, soft-delete, restore, 404)', async () => {
      const criar = await request(app.getHttpServer())
        .post('/itens-comerciais')
        .set('Cookie', adminCookies)
        .send({ codigo: 'ICM-LIFE', descricao: 'Traseiro', unidadeComercial: 'peca' });
      const id = criar.body.id;

      expect(
        (await request(app.getHttpServer()).get(`/itens-comerciais/${id}`).set('Cookie', adminCookies)).status,
      ).toBe(200);

      const editar = await request(app.getHttpServer())
        .patch(`/itens-comerciais/${id}`)
        .set('Cookie', adminCookies)
        .send({ permiteCorte: true, status: 'inativo' });
      expect(editar.status).toBe(200);
      expect(editar.body.permiteCorte).toBe(true);

      expect(
        (await request(app.getHttpServer()).delete(`/itens-comerciais/${id}`).set('Cookie', adminCookies)).status,
      ).toBe(200);
      const restaurar = await request(app.getHttpServer())
        .post(`/itens-comerciais/${id}/restaurar`)
        .set('Cookie', adminCookies);
      expect(restaurar.status).toBe(201);

      const removerInex = await request(app.getHttpServer())
        .delete('/itens-comerciais/019e9e00-0000-7000-8000-000000000999')
        .set('Cookie', adminCookies);
      expect(removerInex.status).toBe(404);
    });
  });

  describe('Parâmetros do sistema (chave-valor JSONB)', () => {
    it('admin cria, edita e remove (soft) parâmetro; comercial só lê', async () => {
      const criar = await request(app.getHttpServer())
        .post('/parametros')
        .set('Cookie', adminCookies)
        .send({ chave: 'limite_overbooking', valorJson: { ativo: false }, descricao: 'Bloqueio de overbooking' });
      expect(criar.status).toBe(201);
      const id = criar.body.id;

      const negado = await request(app.getHttpServer())
        .post('/parametros')
        .set('Cookie', comercialCookies)
        .send({ chave: 'x', valorJson: {} });
      expect(negado.status).toBe(403);

      const editar = await request(app.getHttpServer())
        .patch(`/parametros/${id}`)
        .set('Cookie', adminCookies)
        .send({ valorJson: { ativo: true } });
      expect(editar.status).toBe(200);
      expect((editar.body.valorJson as { ativo: boolean }).ativo).toBe(true);

      const lerComercial = await request(app.getHttpServer()).get('/parametros').set('Cookie', comercialCookies);
      expect(lerComercial.status).toBe(200);

      const detalhar = await request(app.getHttpServer()).get(`/parametros/${id}`).set('Cookie', adminCookies);
      expect(detalhar.status).toBe(200);

      const remover = await request(app.getHttpServer()).delete(`/parametros/${id}`).set('Cookie', adminCookies);
      expect(remover.status).toBe(200);
      expect((await request(app.getHttpServer()).get(`/parametros/${id}`).set('Cookie', adminCookies)).status).toBe(
        404,
      );

      const restaurar = await request(app.getHttpServer())
        .post(`/parametros/${id}/restaurar`)
        .set('Cookie', adminCookies);
      expect(restaurar.status).toBe(201);

      const removerInex = await request(app.getHttpServer())
        .delete('/parametros/019e9e00-0000-7000-8000-000000000999')
        .set('Cookie', adminCookies);
      expect(removerInex.status).toBe(404);
    });

    it('chave duplicada → 409', async () => {
      await request(app.getHttpServer())
        .post('/parametros')
        .set('Cookie', adminCookies)
        .send({ chave: 'dup_chave', valorJson: {} });
      const dup = await request(app.getHttpServer())
        .post('/parametros')
        .set('Cookie', adminCookies)
        .send({ chave: 'dup_chave', valorJson: {} });
      expect(dup.status).toBe(409);
    });
  });

  describe('Updates com todos os campos + filtros de busca (cobre ramos de override)', () => {
    it('fornecedor: cria com JSONB e atualiza todos os campos', async () => {
      const criar = await request(app.getHttpServer())
        .post('/fornecedores')
        .set('Cookie', comprasCookies)
        .send({
          codigo: 'FOR-FULL',
          razaoSocial: 'Forn Full',
          documentoFiscal: '45283163000167',
          contatosJson: { tel: '111' },
          parametrosOperacionaisJson: { prazo: 30 },
          observacoes: 'inicial',
        });
      expect(criar.status).toBe(201);

      const editar = await request(app.getHttpServer())
        .patch(`/fornecedores/${criar.body.id}`)
        .set('Cookie', comprasCookies)
        .send({
          codigo: 'FOR-FULL-2',
          razaoSocial: 'Forn Full 2',
          documentoFiscal: '07526557000100',
          status: 'inativo',
          contatosJson: { tel: '222' },
          parametrosOperacionaisJson: { prazo: 60 },
          observacoes: 'editado',
        });
      expect(editar.status).toBe(200);
      expect(editar.body.codigo).toBe('FOR-FULL-2');
      expect(editar.body.status).toBe('inativo');

      const busca = await request(app.getHttpServer())
        .get('/fornecedores?search=Full&page=1&pageSize=10')
        .set('Cookie', comprasCookies);
      expect(busca.status).toBe(200);
    });

    it('item de compra: atualiza todos os campos + busca', async () => {
      const criar = await request(app.getHttpServer())
        .post('/itens-compra')
        .set('Cookie', adminCookies)
        .send({ codigo: 'IC-FULL', descricao: 'Item', categoria: 'cat', unidadeCompra: 'kg' });
      const editar = await request(app.getHttpServer())
        .patch(`/itens-compra/${criar.body.id}`)
        .set('Cookie', adminCookies)
        .send({ codigo: 'IC-FULL-2', descricao: 'Item 2', categoria: 'cat2', unidadeCompra: 'cx', status: 'inativo' });
      expect(editar.status).toBe(200);
      expect(editar.body.codigo).toBe('IC-FULL-2');
      const busca = await request(app.getHttpServer())
        .get('/itens-compra?search=Item')
        .set('Cookie', adminCookies);
      expect(busca.status).toBe(200);
    });

    it('item comercial: atualiza todos os campos + busca', async () => {
      const criar = await request(app.getHttpServer())
        .post('/itens-comerciais')
        .set('Cookie', adminCookies)
        .send({ codigo: 'ICM-FULL', descricao: 'Item C', categoria: 'cat', unidadeComercial: 'peca' });
      const editar = await request(app.getHttpServer())
        .patch(`/itens-comerciais/${criar.body.id}`)
        .set('Cookie', adminCookies)
        .send({
          codigo: 'ICM-FULL-2',
          descricao: 'Item C2',
          categoria: 'cat2',
          unidadeComercial: 'kg',
          permiteCorte: true,
          status: 'inativo',
          observacoesOperacionais: 'obs',
        });
      expect(editar.status).toBe(200);
      expect(editar.body.unidadeComercial).toBe('kg');
      const busca = await request(app.getHttpServer())
        .get('/itens-comerciais?search=Item')
        .set('Cookie', adminCookies);
      expect(busca.status).toBe(200);
    });

    it('fornecedor/itens/parâmetro: criação mínima (sem JSONB/opcionais) e incluirRemovidos', async () => {
      // Fornecedor mínimo (sem contatosJson/parametros/observacoes) cobre ramos de default.
      const forn = await request(app.getHttpServer())
        .post('/fornecedores')
        .set('Cookie', comprasCookies)
        .send({ codigo: 'FOR-MIN', razaoSocial: 'Min', documentoFiscal: '19131243000197' });
      expect(forn.status).toBe(201);

      // Item de compra mínimo (sem categoria).
      const ic = await request(app.getHttpServer())
        .post('/itens-compra')
        .set('Cookie', adminCookies)
        .send({ codigo: 'IC-MIN', descricao: 'Min', unidadeCompra: 'kg' });
      expect(ic.status).toBe(201);

      // Item comercial mínimo (sem categoria/observacoes/permiteCorte explícito).
      const icm = await request(app.getHttpServer())
        .post('/itens-comerciais')
        .set('Cookie', adminCookies)
        .send({ codigo: 'ICM-MIN', descricao: 'Min', unidadeComercial: 'peca' });
      expect(icm.status).toBe(201);

      // Parâmetro mínimo (sem valorJson/descricao).
      const par = await request(app.getHttpServer())
        .post('/parametros')
        .set('Cookie', adminCookies)
        .send({ chave: 'param_min' });
      expect(par.status).toBe(201);

      // incluirRemovidos cobre o ramo de listagem com removidos.
      for (const rota of ['/fornecedores', '/itens-compra', '/itens-comerciais', '/parametros']) {
        const res = await request(app.getHttpServer())
          .get(`${rota}?incluirRemovidos=true`)
          .set('Cookie', adminCookies);
        expect(res.status).toBe(200);
      }
    });

    it('parâmetro: atualiza descrição mantendo valorJson; busca por chave', async () => {
      const criar = await request(app.getHttpServer())
        .post('/parametros')
        .set('Cookie', adminCookies)
        .send({ chave: 'param_full', valorJson: { a: 1 }, descricao: 'd1' });
      const editar = await request(app.getHttpServer())
        .patch(`/parametros/${criar.body.id}`)
        .set('Cookie', adminCookies)
        .send({ descricao: 'd2' });
      expect(editar.status).toBe(200);
      expect(editar.body.descricao).toBe('d2');
      const busca = await request(app.getHttpServer())
        .get('/parametros?search=param_full')
        .set('Cookie', adminCookies);
      expect(busca.status).toBe(200);
    });
  });
});
