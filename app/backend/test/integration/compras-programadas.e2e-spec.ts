import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';

describe('Compras programadas e2e (CRUD + RBAC + imutabilidade)', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let comercialCookies: string;
  let base: Awaited<ReturnType<typeof seedComercialBase>>;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    base = await seedComercialBase(app, { fator: 4 });
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const novaCompra = (over: Record<string, unknown> = {}) => ({
    dataOperacao: '2026-06-06',
    fornecedorId: base.fornecedorId,
    itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 10 }],
    ...over,
  });

  it('compras cria compra programada (rascunho) com itens', async () => {
    const res = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: '2026-07-01' }));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('rascunho');
    expect(res.body.itens).toHaveLength(1);
  });

  it('comercial (sem COMPRAS_PROGRAMADAS_GERENCIAR) recebe 403 ao criar', async () => {
    const res = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comercialCookies)
      .send(novaCompra({ dataOperacao: '2026-07-02' }));
    expect(res.status).toBe(403);
  });

  it('comercial consegue LER compras (COMPRAS_PROGRAMADAS_LER)', async () => {
    const res = await request(app.getHttpServer())
      .get('/comercial/compras-programadas')
      .set('Cookie', comercialCookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('permite editar item enquanto em rascunho', async () => {
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: '2026-07-03' }));
    const compraId = criar.body.id;
    const itemId = criar.body.itens[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/comercial/compras-programadas/${compraId}/itens/${itemId}`)
      .set('Cookie', comprasCookies)
      .send({ quantidadeComprada: 20 });
    expect(res.status).toBe(200);
    expect(Number(res.body.quantidadeComprada)).toBe(20);
  });

  it('IMUTABILIDADE: editar item após confirmar retorna 409', async () => {
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: '2026-07-04' }));
    const compraId = criar.body.id;
    const itemId = criar.body.itens[0].id;

    const confirmar = await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    expect(confirmar.status).toBe(201);
    expect(confirmar.body.compra.status).toBe('confirmada');

    const editar = await request(app.getHttpServer())
      .patch(`/comercial/compras-programadas/${compraId}/itens/${itemId}`)
      .set('Cookie', comprasCookies)
      .send({ quantidadeComprada: 99 });
    expect(editar.status).toBe(409);
  });

  it('atualiza cabeçalho da compra em rascunho (numeroInterno, observacoes, status)', async () => {
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: '2026-07-10' }));
    const compraId = criar.body.id;

    const res = await request(app.getHttpServer())
      .patch(`/comercial/compras-programadas/${compraId}`)
      .set('Cookie', comprasCookies)
      .send({ numeroInterno: 'NI-123', observacoes: 'obs', status: 'em_negociacao' });
    expect(res.status).toBe(200);
    expect(res.body.numeroInterno).toBe('NI-123');
    expect(res.body.status).toBe('em_negociacao');
  });

  it('detalhar retorna a compra com itens; 404 para inexistente', async () => {
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: '2026-07-11' }));
    const detalhe = await request(app.getHttpServer())
      .get(`/comercial/compras-programadas/${criar.body.id}`)
      .set('Cookie', comprasCookies);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.itens).toHaveLength(1);

    const inexistente = await request(app.getHttpServer())
      .get('/comercial/compras-programadas/019e0000-0000-7000-8000-0000000000ff')
      .set('Cookie', comprasCookies);
    expect(inexistente.status).toBe(404);
  });

  it('listar com incluirRemovidos=true não quebra', async () => {
    const res = await request(app.getHttpServer())
      .get('/comercial/compras-programadas?incluirRemovidos=true')
      .set('Cookie', comprasCookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('confirmar compra CANCELADA → 409', async () => {
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: '2026-07-20' }));
    await request(app.getHttpServer())
      .delete(`/comercial/compras-programadas/${criar.body.id}`)
      .set('Cookie', comprasCookies)
      .send();
    const confirmar = await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${criar.body.id}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    expect(confirmar.status).toBe(409);
  });

  it('confirmar compra inexistente → 404; cancelar confirmada → 409', async () => {
    const inexistente = await request(app.getHttpServer())
      .post('/comercial/compras-programadas/019e0000-0000-7000-8000-0000000000aa/confirmar')
      .set('Cookie', comprasCookies)
      .send();
    expect(inexistente.status).toBe(404);

    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: '2026-07-12' }));
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${criar.body.id}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    const cancelar = await request(app.getHttpServer())
      .delete(`/comercial/compras-programadas/${criar.body.id}`)
      .set('Cookie', comprasCookies)
      .send();
    expect(cancelar.status).toBe(409);
  });

  it('uma compra ATIVA por dia: segunda compra no mesmo dia falha (409/500 via unique)', async () => {
    const dia = '2026-08-15';
    const primeira = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: dia }));
    expect(primeira.status).toBe(201);

    const segunda = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: dia }));
    expect(segunda.status).toBeGreaterThanOrEqual(400);

    // S2: após cancelar a primeira, o dia é liberado para nova compra.
    const cancelar = await request(app.getHttpServer())
      .delete(`/comercial/compras-programadas/${primeira.body.id}`)
      .set('Cookie', comprasCookies)
      .send();
    expect(cancelar.status).toBe(200);

    const terceira = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send(novaCompra({ dataOperacao: dia }));
    expect(terceira.status).toBe(201);
  });
});
