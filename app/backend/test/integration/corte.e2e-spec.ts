import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import { iniciarCorte, adicionarSubitem, pesarSubitem, subitemCompleto } from '../helpers/corte-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Corte/Transformação e2e (F4c)', () => {
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
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  async function cenario(dataOperacao: string, quantidade = 10): Promise<CenarioPesagem> {
    const base = await seedComercialBase(app, { fator: 1 });
    return montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao, quantidade },
    );
  }

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
    fakes(app).impressora.definirStatus('disponivel');
  });

  it('403 sem CORTE_GERENCIAR (comercial não pode iniciar corte)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-01');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const res = await request(srv())
      .post(`/operacao/corte/pecas/${pecaId}/iniciar`)
      .set('Cookie', comercialCookies)
      .send({ tipoTransformacao: 'simples', motivo: 'necessidade_operacional' });
    expect(res.status).toBe(403);
  });

  it('iniciar libera a unidade da origem (atendida −1) e marca em_transformacao', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-02');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });

    const antes = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, p.pedidoItemId)).then((r) => r[0]!);
    expect(antes.quantidadeAtendida).toBe('1.000');

    await iniciarCorte(app, corteCookies, pecaId);

    const depois = await db().select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, p.pedidoItemId)).then((r) => r[0]!);
    expect(depois.quantidadeAtendida).toBe('0.000');

    const peca = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaId)).then((r) => r[0]!);
    expect(peca.statusPeca).toBe('em_transformacao');
    expect(peca.pedidoVendaItemId).toBeNull();
  });

  it('peça inelegível (já transformada) → 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-03');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await db().update(schema.pecas).set({ statusPeca: 'transformada' }).where(eq(schema.pecas.id, pecaId));
    const res = await request(srv())
      .post(`/operacao/corte/pecas/${pecaId}/iniciar`)
      .set('Cookie', corteCookies)
      .send({ tipoTransformacao: 'simples', motivo: 'necessidade_operacional' });
    expect(res.status).toBe(409);
  });

  it('conservação de peso: Σ > original sem justificativa → 409; com justificativa → 201', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-04');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 5,
    });
    fakes(app).balanca.definirPeso('12.500');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);

    fakes(app).balanca.definirPeso('13.000');
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    const semJust = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(semJust.status).toBe(409);

    const comJust = await request(srv())
      .post(`/operacao/corte/${transfId}/concluir`)
      .set('Cookie', corteCookies)
      .send({ justificativaDiferenca: 'ganho por hidratação medido' });
    expect(comJust.status).toBe(201);
    expect(comJust.body.statusTransformacao).toBe('concluida');
  });

  it('conservação de peso: Σ < original (perda) sem justificativa → 409; com justificativa → 201', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-14');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 5,
    });
    fakes(app).balanca.definirPeso('12.500');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);

    fakes(app).balanca.definirPeso('10.000'); // perda de 2.500
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    const semJust = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(semJust.status).toBe(409);

    const comJust = await request(srv())
      .post(`/operacao/corte/${transfId}/concluir`)
      .set('Cookie', corteCookies)
      .send({ justificativaDiferenca: 'apara removida conforme padrão' });
    expect(comJust.status).toBe(201);
  });

  it('concluir com subitem sem destino (só pesado) → 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-05');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, subId);
    const res = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(res.status).toBe(409);
  });

  it('concluir com subitem sem etiqueta → 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-15');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 5,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
    await pesarSubitem(app, corteCookies, subId);
    // Associa mas NÃO emite etiqueta
    await request(srv()).post(`/operacao/corte/subitens/${subId}/associar`).set('Cookie', corteCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    const res = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({ justificativaDiferenca: 'perda nos aparas' });
    expect(res.status).toBe(409);
  });

  it('origem permanece consultável, vira transformada; etiqueta original coexiste; conclusão idempotente', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-10-06');
    const p = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 5,
    });
    fakes(app).balanca.definirPeso('12.500');
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`).set('Cookie', recebimentoCookies).send();
    const pecaAntes = await db().select().from(schema.pecas).where(eq(schema.pecas.id, pecaId)).then((r) => r[0]!);
    const etiquetaOriginal = pecaAntes.etiquetaAtual;

    const transfId = await iniciarCorte(app, corteCookies, pecaId);
    // Dois subitens com peso somando exatamente o original (12.500 / 2 = 6.250 cada)
    fakes(app).balanca.definirPeso('6.250');
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);
    await subitemCompleto(app, corteCookies, transfId, c.itemComercialId, p.pedidoItemId);

    const ok = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(ok.status).toBe(201);

    // Peça original consultável, transformada, etiqueta original preservada
    const pecaDepois = await request(srv()).get(`/operacao/pesagem/pecas/${pecaId}`).set('Cookie', recebimentoCookies);
    expect(pecaDepois.status).toBe(200);
    expect(pecaDepois.body.statusPeca).toBe('transformada');
    expect(pecaDepois.body.etiquetaAtual).toBe(etiquetaOriginal);

    // Idempotência: concluir de novo retorna 201 sem mudar estado
    const denovo = await request(srv()).post(`/operacao/corte/${transfId}/concluir`).set('Cookie', corteCookies).send({});
    expect(denovo.status).toBe(201);
    expect(denovo.body.statusTransformacao).toBe('concluida');
  });
});
