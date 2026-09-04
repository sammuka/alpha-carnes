import type { INestApplication } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNull } from 'drizzle-orm';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { seedRegrasTransformacaoTz } from '../../src/database/seed-regras-transformacao-tz';
import { STATUS_CAMINHAO_FECHADO } from '../../src/modules/operacao/pesagem/carga-fechada';
import { createTestUser, loginCookies, createTestApp, cleanupDb } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import {
  montarCenarioPesagem,
  criarPedido,
  pesarPeca,
  fakes,
} from '../helpers/pesagem-fixtures';
import { iniciarCorte, subitemCompleto } from '../helpers/corte-fixtures';

type Db = NodePgDatabase<typeof schema>;

async function seedFixtureEtiquetaSubitemEmCargaFechada(
  app: INestApplication,
): Promise<{ operacaoId: string; pecaMaeId: string; subitemId: string; cookiesCorte: string }> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
  const compras = await createTestUser(app, { perfil: 'compras' });
  const comercial = await createTestUser(app, { perfil: 'comercial' });
  const corte = await createTestUser(app, { perfil: 'corte' });
  const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
  const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
  const cookiesComercial = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  const cookiesCorte = await loginCookies(app, corte.adminEmail, corte.adminPassword);

  await seedCatalogoMvp(db);
  await seedRegrasTransformacaoTz(db);

  const base = await seedComercialBase(app, { fator: 1 });
  const c = await montarCenarioPesagem(
    app,
    { compras: cookiesCompras, recebimento: cookiesReceb },
    base,
    { dataOperacao: '2026-07-31', quantidade: 10 },
  );
  const [rec] = await db
    .select({ operacaoId: schema.recebimentos.operacaoId })
    .from(schema.recebimentos)
    .where(eq(schema.recebimentos.id, c.recebimentoId));
  if (!rec?.operacaoId) throw new Error('operacaoId ausente no recebimento da fixture 7.21b');
  const operacaoId = rec.operacaoId;

  fakes(app).balanca.definirStatus('disponivel');
  fakes(app).balanca.definirPeso('12.000');
  fakes(app).impressora.definirStatus('disponivel');

  const pecaMaeId = await pesarPeca(app, cookiesReceb, {
    recebimentoId: c.recebimentoId,
    produtoBaseId: c.produtoId,
  });
  const transformacaoId = await iniciarCorte(app, cookiesCorte, pecaMaeId);

  const [regraA] = await db
    .select({ id: schema.regrasTransformacao.id })
    .from(schema.regrasTransformacao)
    .where(
      and(
        eq(schema.regrasTransformacao.codigo, 'TZ_A'),
        isNull(schema.regrasTransformacao.deletedAt),
      ),
    )
    .limit(1);
  if (!regraA) throw new Error('Regra seed TZ_A ausente');
  const bind = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/regra`)
    .set('Cookie', cookiesCorte)
    .send({ regraTransformacaoId: regraA.id });
  if (bind.status !== 200 && bind.status !== 201) {
    throw new Error(`Falha ao vincular TZ_A: ${bind.status} ${JSON.stringify(bind.body)}`);
  }

  const [saidaCb] = await db
    .select({ produtoId: schema.produtos.legadoprodutoId })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'CB'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  if (!saidaCb?.produtoId) throw new Error('Produto CB seed sem legadoprodutoId');
  const itemSaidaRegraId = saidaCb.produtoId;

  const pedido = await criarPedido(app, cookiesComercial, {
    compraId: c.compraId,
    clienteId: c.clienteId,
    produtoId: itemSaidaRegraId,
    dataOperacao: c.dataOperacao,
    quantidade: 5,
  });
  const subitemId = await subitemCompleto(
    app,
    cookiesCorte,
    transformacaoId,
    itemSaidaRegraId,
    pedido.pedidoItemId,
  );

  const [caminhao] = await db
    .insert(schema.caminhoes)
    .values({
      placa: `O721B-${Date.now().toString(36).slice(-5)}`,
      motorista: 'Motorista Fixture DoD 7.21b',
      operacaoId,
      statusCaminhao: 'fechado',
    })
    .returning();
  if (!caminhao) throw new Error('Falha ao semear caminhão fechado DoD 7.21b');

  await db.insert(schema.cargaItens).values({
    caminhaoId: caminhao.id,
    tipoOrigem: 'subitem',
    subitemId,
    pecaId: null,
    pedidoVendaId: pedido.pedidoId,
    pedidoVendaItemId: pedido.pedidoItemId,
    statusCargaItem: 'em_carga',
    conferido: false,
  });

  return { operacaoId, pecaMaeId, subitemId, cookiesCorte };
}

async function seedFixtureEtiquetaSubitemSemCarga(
  app: INestApplication,
): Promise<{ operacaoId: string; subitemIdSemCarga: string; cookiesCorte: string }> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
  const compras = await createTestUser(app, { perfil: 'compras' });
  const comercial = await createTestUser(app, { perfil: 'comercial' });
  const corte = await createTestUser(app, { perfil: 'corte' });
  const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
  const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
  const cookiesComercial = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  const cookiesCorte = await loginCookies(app, corte.adminEmail, corte.adminPassword);

  await seedCatalogoMvp(db);
  await seedRegrasTransformacaoTz(db);

  const base = await seedComercialBase(app, { fator: 1 });
  const c = await montarCenarioPesagem(
    app,
    { compras: cookiesCompras, recebimento: cookiesReceb },
    base,
    { dataOperacao: '2026-08-01', quantidade: 10 },
  );
  const [rec] = await db
    .select({ operacaoId: schema.recebimentos.operacaoId })
    .from(schema.recebimentos)
    .where(eq(schema.recebimentos.id, c.recebimentoId));
  if (!rec?.operacaoId) throw new Error('operacaoId ausente na fixture 7.21b-sem-carga');
  const operacaoId = rec.operacaoId;

  fakes(app).balanca.definirStatus('disponivel');
  fakes(app).balanca.definirPeso('11.000');
  fakes(app).impressora.definirStatus('disponivel');

  const pecaMaeId = await pesarPeca(app, cookiesReceb, {
    recebimentoId: c.recebimentoId,
    produtoBaseId: c.produtoId,
  });
  const transformacaoId = await iniciarCorte(app, cookiesCorte, pecaMaeId);

  const [regraA] = await db
    .select({ id: schema.regrasTransformacao.id })
    .from(schema.regrasTransformacao)
    .where(
      and(
        eq(schema.regrasTransformacao.codigo, 'TZ_A'),
        isNull(schema.regrasTransformacao.deletedAt),
      ),
    )
    .limit(1);
  if (!regraA) throw new Error('Regra seed TZ_A ausente');
  const bind = await request(app.getHttpServer())
    .post(`/operacao/corte/${transformacaoId}/regra`)
    .set('Cookie', cookiesCorte)
    .send({ regraTransformacaoId: regraA.id });
  if (bind.status !== 200 && bind.status !== 201) {
    throw new Error(`Falha ao vincular TZ_A: ${bind.status}`);
  }

  const [saidaCb] = await db
    .select({ produtoId: schema.produtos.legadoprodutoId })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, 'CB'), isNull(schema.produtos.deletedAt)))
    .limit(1);
  if (!saidaCb?.produtoId) throw new Error('Produto CB seed sem legadoprodutoId');
  const itemSaidaRegraId = saidaCb.produtoId;

  const pedido = await criarPedido(app, cookiesComercial, {
    compraId: c.compraId,
    clienteId: c.clienteId,
    produtoId: itemSaidaRegraId,
    dataOperacao: c.dataOperacao,
    quantidade: 5,
  });
  const subitemIdSemCarga = await subitemCompleto(
    app,
    cookiesCorte,
    transformacaoId,
    itemSaidaRegraId,
    pedido.pedidoItemId,
  );

  return { operacaoId, subitemIdSemCarga, cookiesCorte };
}

describe('Onda 7 — desossa', () => {
  let app: INestApplication;
  let db: Db;
  let operacaoId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDb(app);
    await seedCatalogoMvp(db);
    await seedRegrasTransformacaoTz(db);
    const compras = await createTestUser(app, { perfil: 'compras' });
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const c = await montarCenarioPesagem(
      app,
      { compras: cookiesCompras, recebimento: cookiesReceb },
      base,
      { dataOperacao: '2026-07-30', quantidade: 5 },
    );
    const [rec] = await db
      .select({ operacaoId: schema.recebimentos.operacaoId })
      .from(schema.recebimentos)
      .where(eq(schema.recebimentos.id, c.recebimentoId));
    operacaoId = rec!.operacaoId;
  });

  describe('DoD 7.14b — pecas-elegiveis RequireQualquerPermissao', () => {
    it('comercial (DESOSSA_PAINEL_LER, sem CORTE_GERENCIAR) → 200', async () => {
      const comercial = await createTestUser(app, { perfil: 'comercial' });
      const cookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
      const res = await request(app.getHttpServer())
        .get(`/operacao/corte/pecas-elegiveis?operacaoId=${operacaoId}`)
        .set('Cookie', cookies);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('perfil sem nenhuma das 3 perms (faturamento) → 403', async () => {
      const fat = await createTestUser(app, { perfil: 'faturamento' });
      const cookies = await loginCookies(app, fat.adminEmail, fat.adminPassword);
      const res = await request(app.getHttpServer())
        .get(`/operacao/corte/pecas-elegiveis?operacaoId=${operacaoId}`)
        .set('Cookie', cookies);
      expect(res.status).toBe(403);
    });
  });

  it('DoD 7.6: adicionar sem regra → 409 REGRA_TRANSFORMACAO_OBRIGATORIA', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const cookiesCorte = await loginCookies(app, corte.adminEmail, corte.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: cookiesCompras, recebimento: cookiesReceb },
      base,
      { dataOperacao: '2026-07-29', quantidade: 5 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('10.000');
    const pecaId = await pesarPeca(app, cookiesReceb, {
      recebimentoId: c.recebimentoId,
      produtoBaseId: c.produtoId,
    });
    const transformacaoId = await iniciarCorte(app, cookiesCorte, pecaId);
    const [cb] = await db
      .select({ id: schema.produtos.legadoprodutoId })
      .from(schema.produtos)
      .where(eq(schema.produtos.codigo, 'CB'))
      .limit(1);
    const res = await request(app.getHttpServer())
      .post(`/operacao/corte/${transformacaoId}/subitens`)
      .set('Cookie', cookiesCorte)
      .send({ produtoId: cb!.id });
    expect(res.status).toBe(409);
    // AllExceptionsFilter envelopa HttpException.getResponse() em `message`
    const payload = typeof res.body.message === 'object' ? res.body.message : res.body;
    expect(payload.codigo).toBe('REGRA_TRANSFORMACAO_OBRIGATORIA');
  });

  it('DoD 7.21b: bloqueada=true quando subitem está em carga fechada (não peca_id da mãe)', async () => {
    expect(STATUS_CAMINHAO_FECHADO).toContain('fechado');

    const { operacaoId: opId, subitemId, cookiesCorte } =
      await seedFixtureEtiquetaSubitemEmCargaFechada(app);

    const res = await request(app.getHttpServer())
      .get(`/desossa/etiquetas?operacaoId=${opId}`)
      .set('Cookie', cookiesCorte);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toEqual(
      expect.objectContaining({
        data: expect.any(Array),
        total: expect.any(Number),
        page: expect.any(Number),
        pageSize: expect.any(Number),
      }),
    );
    const etq = (res.body.data as Array<{ subitemId: string; bloqueada: boolean }>).find(
      (e) => e.subitemId === subitemId,
    );
    expect(etq).toBeDefined();
    expect(etq!.bloqueada).toBe(true);
  });

  it('DoD 7.21b: mãe em_transformacao sem subitem na carga ⇒ bloqueada=false', async () => {
    const { operacaoId: opId, subitemIdSemCarga, cookiesCorte } =
      await seedFixtureEtiquetaSubitemSemCarga(app);

    const res = await request(app.getHttpServer())
      .get(`/desossa/etiquetas?operacaoId=${opId}`)
      .set('Cookie', cookiesCorte);
    expect(res.status).toBe(200);
    const etq = (res.body.data as Array<{ subitemId: string; bloqueada: boolean }>).find(
      (e) => e.subitemId === subitemIdSemCarga,
    );
    expect(etq).toBeDefined();
    expect(etq!.bloqueada).toBe(false);
  });

  it('GET /desossa/painel exige DESOSSA_PAINEL_LER', async () => {
    const fat = await createTestUser(app, { perfil: 'faturamento' });
    const cookies = await loginCookies(app, fat.adminEmail, fat.adminPassword);
    const res = await request(app.getHttpServer())
      .get('/desossa/painel')
      .set('Cookie', cookies);
    expect(res.status).toBe(403);
  });

  it('DoD 7.7: regra A + item da B → 409 SAIDA_FORA_DA_REGRA', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const cookiesCorte = await loginCookies(app, corte.adminEmail, corte.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: cookiesCompras, recebimento: cookiesReceb },
      base,
      { dataOperacao: '2026-07-28', quantidade: 5 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('10.000');
    const pecaId = await pesarPeca(app, cookiesReceb, {
      recebimentoId: c.recebimentoId,
      produtoBaseId: c.produtoId,
    });
    const transformacaoId = await iniciarCorte(app, cookiesCorte, pecaId);
    const [regraA] = await db
      .select({ id: schema.regrasTransformacao.id })
      .from(schema.regrasTransformacao)
      .where(eq(schema.regrasTransformacao.codigo, 'TZ_A'))
      .limit(1);
    await request(app.getHttpServer())
      .post(`/operacao/corte/${transformacaoId}/regra`)
      .set('Cookie', cookiesCorte)
      .send({ regraTransformacaoId: regraA!.id });
    const [fc] = await db
      .select({ id: schema.produtos.legadoprodutoId })
      .from(schema.produtos)
      .where(eq(schema.produtos.codigo, 'FC'))
      .limit(1);
    const res = await request(app.getHttpServer())
      .post(`/operacao/corte/${transformacaoId}/subitens`)
      .set('Cookie', cookiesCorte)
      .send({ produtoId: fc!.id });
    expect(res.status).toBe(409);
    const payload = typeof res.body.message === 'object' ? res.body.message : res.body;
    expect(payload.codigo).toBe('SAIDA_FORA_DA_REGRA');
  });
});
