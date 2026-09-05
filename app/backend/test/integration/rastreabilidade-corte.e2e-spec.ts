import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes } from '../helpers/pesagem-fixtures';
import { iniciarCorte, subitemCompleto } from '../helpers/corte-fixtures';

describe('Rastreabilidade do corte e2e (F4c — RF-CT-19/20)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let corteCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('consulta da cadeia origem → corte → subitens → etiquetas → destino por peça e por subitem', async () => {
    const { default: request } = await import('supertest');
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: '2026-12-10', quantidade: 10 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('6.250');
    fakes(app).impressora.definirStatus('disponivel');

    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      produtoId: c.produtoId,
      dataOperacao: c.dataOperacao,
      quantidade: 5,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const sub1 = await subitemCompleto(app, corteCookies, transfId, c.produtoId, p.pedidoItemId);
    const sub2 = await subitemCompleto(app, corteCookies, transfId, c.produtoId, p.pedidoItemId);

    // Consulta por peça
    const porPeca = await request(srv())
      .get(`/operacao/corte/rastreabilidade/consulta?pecaId=${pecaId}`)
      .set('Cookie', corteCookies);
    expect(porPeca.status).toBe(200);
    expect(porPeca.body.peca.id).toBe(pecaId);
    expect(porPeca.body.transformacoes.length).toBe(1);
    expect(porPeca.body.subitens.length).toBe(2);
    expect(porPeca.body.etiquetasSubitens.length).toBeGreaterThanOrEqual(2);

    // Consulta por subitem (deve resolver a mesma cadeia)
    const porSub = await request(srv())
      .get(`/operacao/corte/rastreabilidade/consulta?subitemId=${sub1}`)
      .set('Cookie', corteCookies);
    expect(porSub.status).toBe(200);
    expect(porSub.body.peca.id).toBe(pecaId);
    expect(porSub.body.subitens.map((s: { id: string }) => s.id)).toEqual(
      expect.arrayContaining([sub1, sub2]),
    );
  });
});
