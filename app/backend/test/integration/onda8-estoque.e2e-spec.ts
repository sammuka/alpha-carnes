import type { INestApplication } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNull } from 'drizzle-orm';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { createTestUser, loginCookies, createTestApp, cleanupDb } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes } from '../helpers/pesagem-fixtures';

type Db = NodePgDatabase<typeof schema>;

async function destinarPecaSobra(
  app: INestApplication,
  cookiesReceb: string,
  pecaId: string,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .post(`/operacao/pesagem/pecas/${pecaId}/sem-cobertura`)
    .set('Cookie', cookiesReceb)
    .send({ destino: 'sobra', motivo: 'fixture onda8' });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`fixture não gerou peça em_sobra: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

/** Upsert do parâmetro (tabela vazia em teste — seed.ts não corre aqui). */
async function definirFifoEstoque(db: Db, valor: boolean): Promise<void> {
  await db
    .insert(schema.parametros)
    .values({ chave: 'operacao.fifo_estoque', valorJson: { valor } })
    .onConflictDoUpdate({ target: schema.parametros.chave, set: { valorJson: { valor } } });
}

/** Ajustes acima do limiar exigem uma operação para vincular a aprovação (D8.8). */
async function seedOperacaoAberta(db: Db, data = '2026-08-01'): Promise<void> {
  await db.insert(schema.operacoes).values({
    data,
    diaSemana: new Date(`${data}T00:00:00Z`).getUTCDay(),
    rotulo: `Operação ${data}`,
  }).onConflictDoNothing();
}

async function produtoCaixariaId(db: Db, codigo = 'CXMIU'): Promise<string> {
  const [p] = await db
    .select({ id: schema.produtos.id })
    .from(schema.produtos)
    .where(and(eq(schema.produtos.codigo, codigo), isNull(schema.produtos.deletedAt)))
    .limit(1);
  if (!p) throw new Error(`fixture não encontrou produto seed ${codigo}`);
  return p.id;
}

describe('Onda 8 — Estoque', () => {
  let app: INestApplication;
  let db: Db;

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
  });

  // ── DoD 8.1 / 8.2 — consulta ────────────────────────────────────────────────

  it('DoD 8.1 consulta mapeia status físico para os rótulos do protótipo', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: cookiesCompras, recebimento: cookiesReceb },
      base,
      { dataOperacao: '2026-08-01', quantidade: 5 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.000');
    const pecaId = await pesarPeca(app, cookiesReceb, {
      recebimentoId: c.recebimentoId,
      itemComercialBaseId: c.itemComercialId,
    });
    await destinarPecaSobra(app, cookiesReceb, pecaId);

    const res = await request(app.getHttpServer())
      .get('/estoque/consulta')
      .set('Cookie', cookiesReceb);
    expect(res.status).toBe(200);
    const item = (res.body as Array<{ id: string; statusRotulo: string; tipo: string }>).find((i) => i.id === pecaId);
    if (!item) throw new Error('fixture não apareceu na consulta de estoque');
    expect(item.statusRotulo).toBe('Disponível');
    expect(item.tipo).toBe('peca');
  });

  it('DoD 8.2 ordenação segue parâmetro operacao.fifo_estoque', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: cookiesCompras, recebimento: cookiesReceb },
      base,
      { dataOperacao: '2026-08-01', quantidade: 5 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('10.000');
    const peca1 = await pesarPeca(app, cookiesReceb, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await destinarPecaSobra(app, cookiesReceb, peca1);
    fakes(app).balanca.definirPeso('11.000');
    const peca2 = await pesarPeca(app, cookiesReceb, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await destinarPecaSobra(app, cookiesReceb, peca2);

    await definirFifoEstoque(db, true);
    const ascRes = await request(app.getHttpServer()).get('/estoque/consulta').set('Cookie', cookiesReceb);
    const idsAsc = (ascRes.body as Array<{ id: string }>).map((i) => i.id).filter((id) => id === peca1 || id === peca2);
    expect(idsAsc).toEqual([peca1, peca2]);

    await definirFifoEstoque(db, false);
    const descRes = await request(app.getHttpServer()).get('/estoque/consulta').set('Cookie', cookiesReceb);
    const idsDesc = (descRes.body as Array<{ id: string }>).map((i) => i.id).filter((id) => id === peca1 || id === peca2);
    expect(idsDesc).toEqual([peca2, peca1]);
  });

  // ── DoD 8.3 / 8.4 / 8.5 / 8.6 — destinar peça ────────────────────────────────

  it('DoD 8.3 destinar peça de estoque a pedido', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const cookiesComercial = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: cookiesCompras, recebimento: cookiesReceb },
      base,
      { dataOperacao: '2026-08-01', quantidade: 5 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.000');
    const pecaId = await pesarPeca(app, cookiesReceb, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await destinarPecaSobra(app, cookiesReceb, pecaId);

    const pedido = await criarPedido(app, cookiesComercial, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 3,
    });

    const res = await request(app.getHttpServer())
      .post('/estoque/destinar')
      .set('Cookie', cookiesReceb)
      .send({ tipo: 'peca', id: pecaId, pedidoVendaItemId: pedido.pedidoItemId });
    expect(res.status).toBe(201);

    const [pecaDb] = await db.select().from(schema.pecas).where(eq(schema.pecas.id, pecaId));
    expect(pecaDb?.statusPeca).toBe('associada');
    expect(pecaDb?.pedidoVendaItemId).toBe(pedido.pedidoItemId);

    const historico = await db.select().from(schema.associacoesPecaHistorico).where(eq(schema.associacoesPecaHistorico.pecaId, pecaId));
    expect(historico.some((h) => h.acao === 'destinar_estoque')).toBe(true);
  });

  it('DoD 8.4 destinar item indisponível é rejeitado sem efeito', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const cookiesComercial = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app, { compras: cookiesCompras, recebimento: cookiesReceb }, base,
      { dataOperacao: '2026-08-01', quantidade: 5 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.000');
    const pecaId = await pesarPeca(app, cookiesReceb, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    // peça permanece 'pesada' — nunca foi destinada à sobra: statusPeca !== 'em_sobra'

    const pedido = await criarPedido(app, cookiesComercial, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 3,
    });

    const res = await request(app.getHttpServer())
      .post('/estoque/destinar')
      .set('Cookie', cookiesReceb)
      .send({ tipo: 'peca', id: pecaId, pedidoVendaItemId: pedido.pedidoItemId });
    expect(res.status).toBe(409);
    const payload = typeof res.body.message === 'object' ? res.body.message : res.body;
    expect(payload.codigo).toBe('ITEM_NAO_DISPONIVEL');

    const [pecaDb] = await db.select().from(schema.pecas).where(eq(schema.pecas.id, pecaId));
    expect(pecaDb?.statusPeca).toBe('pesada');
    expect(pecaDb?.pedidoVendaItemId).toBeNull();
  });

  it('DoD 8.5 destinar em item completo não persiste', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const cookiesComercial = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app, { compras: cookiesCompras, recebimento: cookiesReceb }, base,
      { dataOperacao: '2026-08-01', quantidade: 5 },
    );
    const pedido = await criarPedido(app, cookiesComercial, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 1,
    });

    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.000');
    const pecaCompleta = await pesarPeca(app, cookiesReceb, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await destinarPecaSobra(app, cookiesReceb, pecaCompleta);
    const completar = await request(app.getHttpServer())
      .post('/estoque/destinar')
      .set('Cookie', cookiesReceb)
      .send({ tipo: 'peca', id: pecaCompleta, pedidoVendaItemId: pedido.pedidoItemId });
    expect(completar.status).toBe(201); // consome a 1 unidade pedida

    const peca2 = await pesarPeca(app, cookiesReceb, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await destinarPecaSobra(app, cookiesReceb, peca2);
    const res = await request(app.getHttpServer())
      .post('/estoque/destinar')
      .set('Cookie', cookiesReceb)
      .send({ tipo: 'peca', id: peca2, pedidoVendaItemId: pedido.pedidoItemId });
    expect(res.status).toBe(409);
    const payload = typeof res.body.message === 'object' ? res.body.message : res.body;
    expect(payload.codigo).toBe('ITEM_DO_PEDIDO_COMPLETO');

    const [item] = await db.select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pedido.pedidoItemId));
    expect(item?.quantidadeAtendida).toBe('1.000');
    const [peca2Db] = await db.select().from(schema.pecas).where(eq(schema.pecas.id, peca2));
    expect(peca2Db?.statusPeca).toBe('em_sobra');
  });

  it('DoD 8.6 destinar concorrente da mesma peça: um completa, outro 409', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const cookiesComercial = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app, { compras: cookiesCompras, recebimento: cookiesReceb }, base,
      { dataOperacao: '2026-08-01', quantidade: 5 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.000');
    const pecaId = await pesarPeca(app, cookiesReceb, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await destinarPecaSobra(app, cookiesReceb, pecaId);

    const pedidoA = await criarPedido(app, cookiesComercial, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 2,
    });

    const [r1, r2] = await Promise.all([
      request(app.getHttpServer()).post('/estoque/destinar').set('Cookie', cookiesReceb)
        .send({ tipo: 'peca', id: pecaId, pedidoVendaItemId: pedidoA.pedidoItemId }),
      request(app.getHttpServer()).post('/estoque/destinar').set('Cookie', cookiesReceb)
        .send({ tipo: 'peca', id: pecaId, pedidoVendaItemId: pedidoA.pedidoItemId }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const [item] = await db.select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pedidoA.pedidoItemId));
    expect(item?.quantidadeAtendida).toBe('1.000');
  });

  // ── DoD 8.7 / 8.8 — entradas ─────────────────────────────────────────────────

  it('DoD 8.7 entrada de caixaria valida tipo operacional', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const produtoId = await produtoCaixariaId(db);

    const ok = await request(app.getHttpServer())
      .post('/estoque/entradas')
      .set('Cookie', cookiesReceb)
      .send({ produtoId, quantidade: 5, unidade: 'caixa', fornecedorNome: 'Frigorífico X', destino: 'estoque' });
    expect(ok.status).toBe(201);

    const [naoCaixaria] = await db.select({ id: schema.produtos.id }).from(schema.produtos)
      .where(and(eq(schema.produtos.codigo, 'TZ'), isNull(schema.produtos.deletedAt)));
    const falha = await request(app.getHttpServer())
      .post('/estoque/entradas')
      .set('Cookie', cookiesReceb)
      .send({ produtoId: naoCaixaria!.id, quantidade: 5, unidade: 'caixa', fornecedorNome: 'Frigorífico X', destino: 'estoque' });
    expect(falha.status).toBe(409);
    const payload = typeof falha.body.message === 'object' ? falha.body.message : falha.body;
    expect(payload.codigo).toBe('PRODUTO_NAO_E_CAIXARIA');

    const entradasNoBanco = await db.select().from(schema.entradasItens);
    expect(entradasNoBanco).toHaveLength(1);
  });

  it('DoD 8.8 entrada destinada a pedido consome saldo atômico', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const cookiesComercial = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);

    const [produtoCx] = await db.select().from(schema.produtos).where(and(eq(schema.produtos.codigo, 'CXMIU'), isNull(schema.produtos.deletedAt)));
    if (!produtoCx?.legadoItemComercialId) throw new Error('fixture: CXMIU sem legadoItemComercialId');

    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app, { compras: cookiesCompras, recebimento: cookiesReceb }, base,
      { dataOperacao: '2026-08-01', quantidade: 5 },
    );
    const pedido = await criarPedido(app, cookiesComercial, {
      compraId: c.compraId, clienteId: c.clienteId, itemComercialId: produtoCx.legadoItemComercialId,
      dataOperacao: c.dataOperacao, quantidade: 3,
    });

    const ok = await request(app.getHttpServer())
      .post('/estoque/entradas')
      .set('Cookie', cookiesReceb)
      .send({
        produtoId: produtoCx.id, quantidade: 3, unidade: 'caixa', fornecedorNome: 'Frigorífico X',
        destino: 'pedido', pedidoVendaItemId: pedido.pedidoItemId,
      });
    expect(ok.status).toBe(201);
    const [item] = await db.select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pedido.pedidoItemId));
    expect(item?.quantidadeAtendida).toBe('3.000');

    const acima = await request(app.getHttpServer())
      .post('/estoque/entradas')
      .set('Cookie', cookiesReceb)
      .send({
        produtoId: produtoCx.id, quantidade: 1, unidade: 'caixa', fornecedorNome: 'Frigorífico X',
        destino: 'pedido', pedidoVendaItemId: pedido.pedidoItemId,
      });
    expect(acima.status).toBe(409);
    const payload = typeof acima.body.message === 'object' ? acima.body.message : acima.body;
    expect(payload.codigo).toBe('ITEM_DO_PEDIDO_COMPLETO');

    const entradasNoBanco = await db.select().from(schema.entradasItens);
    expect(entradasNoBanco).toHaveLength(1);
  });

  // ── DoD 8.9 / 8.10 / 8.11 / 8.12 / 8.13 — ajustes ────────────────────────────

  it('DoD 8.9 ajuste dentro do limiar aplica imediatamente', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const produtoId = await produtoCaixariaId(db);
    const entrada = await request(app.getHttpServer())
      .post('/estoque/entradas')
      .set('Cookie', cookiesReceb)
      .send({ produtoId, quantidade: 10, unidade: 'caixa', fornecedorNome: 'Frigorífico X', destino: 'estoque' });
    const entradaId = entrada.body.id as string;

    const res = await request(app.getHttpServer())
      .post('/estoque/ajustes')
      .set('Cookie', cookiesReceb)
      .send({ tipo: 'entrada', id: entradaId, quantidadeDelta: -3, motivo: 'quebra' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('aplicado');

    const [entradaDb] = await db.select().from(schema.entradasItens).where(eq(schema.entradasItens.id, entradaId));
    expect(entradaDb?.quantidade).toBe(7);
  });

  it('DoD 8.10 ajuste acima do limiar exige aprovação e não aplica', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    await seedOperacaoAberta(db);
    const produtoId = await produtoCaixariaId(db);
    const entrada = await request(app.getHttpServer())
      .post('/estoque/entradas')
      .set('Cookie', cookiesReceb)
      .send({ produtoId, quantidade: 20, unidade: 'caixa', fornecedorNome: 'Frigorífico X', destino: 'estoque' });
    const entradaId = entrada.body.id as string;

    const res = await request(app.getHttpServer())
      .post('/estoque/ajustes')
      .set('Cookie', cookiesReceb)
      .send({ tipo: 'entrada', id: entradaId, quantidadeDelta: -8, motivo: 'erro_contagem' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('aguardando_aprovacao');
    expect(res.body.aprovacaoOperacionalId).toBeTruthy();

    const [entradaDb] = await db.select().from(schema.entradasItens).where(eq(schema.entradasItens.id, entradaId));
    expect(entradaDb?.quantidade).toBe(20); // sem efeito físico

    const [aprovacao] = await db.select().from(schema.aprovacoesOperacionais)
      .where(eq(schema.aprovacoesOperacionais.id, res.body.aprovacaoOperacionalId));
    expect(aprovacao?.tipo).toBe('ajuste_estoque_relevante');
    expect(aprovacao?.status).toBe('pendente');
  });

  it('DoD 8.11 segregação criador≠aprovador', async () => {
    // gestor tem ESTOQUE_AJUSTE_APROVAR (D8.1) — exercita a segregação, não o RBAC guard.
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const cookiesGestor = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    await seedOperacaoAberta(db);
    const produtoId = await produtoCaixariaId(db);
    const entrada = await request(app.getHttpServer())
      .post('/estoque/entradas')
      .set('Cookie', cookiesGestor)
      .send({ produtoId, quantidade: 20, unidade: 'caixa', fornecedorNome: 'Frigorífico X', destino: 'estoque' });
    const entradaId = entrada.body.id as string;
    const criado = await request(app.getHttpServer())
      .post('/estoque/ajustes')
      .set('Cookie', cookiesGestor)
      .send({ tipo: 'entrada', id: entradaId, quantidadeDelta: -8, motivo: 'erro_contagem' });
    const ajusteId = criado.body.id as string;

    const res = await request(app.getHttpServer())
      .post(`/estoque/ajustes/${ajusteId}/aprovar`)
      .set('Cookie', cookiesGestor);
    expect(res.status).toBe(403);
    const payload = typeof res.body.message === 'object' ? res.body.message : res.body;
    expect(payload.codigo).toBe('SEGREGACAO_CRIADOR_APROVADOR');

    const [ajusteDb] = await db.select().from(schema.ajustesEstoque).where(eq(schema.ajustesEstoque.id, ajusteId));
    expect(ajusteDb?.status).toBe('aguardando_aprovacao');
  });

  it('DoD 8.12 aprovar ajuste aplica efeito e fecha aprovação operacional', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesGestor = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    await seedOperacaoAberta(db);
    const produtoId = await produtoCaixariaId(db);
    const entrada = await request(app.getHttpServer())
      .post('/estoque/entradas')
      .set('Cookie', cookiesReceb)
      .send({ produtoId, quantidade: 20, unidade: 'caixa', fornecedorNome: 'Frigorífico X', destino: 'estoque' });
    const entradaId = entrada.body.id as string;
    const criado = await request(app.getHttpServer())
      .post('/estoque/ajustes')
      .set('Cookie', cookiesReceb)
      .send({ tipo: 'entrada', id: entradaId, quantidadeDelta: -8, motivo: 'erro_contagem' });
    const ajusteId = criado.body.id as string;
    const aprovacaoId = criado.body.aprovacaoOperacionalId as string;

    const res = await request(app.getHttpServer())
      .post(`/estoque/ajustes/${ajusteId}/aprovar`)
      .set('Cookie', cookiesGestor);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('aplicado');

    const [entradaDb] = await db.select().from(schema.entradasItens).where(eq(schema.entradasItens.id, entradaId));
    expect(entradaDb?.quantidade).toBe(12);

    const [aprovacaoDb] = await db.select().from(schema.aprovacoesOperacionais).where(eq(schema.aprovacoesOperacionais.id, aprovacaoId));
    expect(aprovacaoDb?.status).toBe('aprovada');
  });

  it('DoD 8.13 aplicação física em peça é unitária e nunca cria peça', async () => {
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const cookiesReceb = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    const cookiesCompras = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app, { compras: cookiesCompras, recebimento: cookiesReceb }, base,
      { dataOperacao: '2026-08-01', quantidade: 5 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.000');
    const pecaMinus1 = await pesarPeca(app, cookiesReceb, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await destinarPecaSobra(app, cookiesReceb, pecaMinus1);

    const okMinus1 = await request(app.getHttpServer())
      .post('/estoque/ajustes')
      .set('Cookie', cookiesReceb)
      .send({ tipo: 'peca', id: pecaMinus1, quantidadeDelta: -1, motivo: 'quebra' });
    expect(okMinus1.status).toBe(201);
    expect(okMinus1.body.status).toBe('aplicado');
    const [pecaDb] = await db.select().from(schema.pecas).where(eq(schema.pecas.id, pecaMinus1));
    expect(pecaDb?.deletedAt).not.toBeNull();

    const pecaPlus1 = await pesarPeca(app, cookiesReceb, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    await destinarPecaSobra(app, cookiesReceb, pecaPlus1);
    const falhaPlus1 = await request(app.getHttpServer())
      .post('/estoque/ajustes')
      .set('Cookie', cookiesReceb)
      .send({ tipo: 'peca', id: pecaPlus1, quantidadeDelta: 1, motivo: 'outro' });
    expect(falhaPlus1.status).toBe(409);
    const payload = typeof falhaPlus1.body.message === 'object' ? falhaPlus1.body.message : falhaPlus1.body;
    expect(payload.codigo).toBe('AJUSTE_INVALIDO_PARA_PECA');

    const totalPecas = await db.select().from(schema.pecas);
    // Nenhuma peça nova foi criada pelo ajuste — só as 2 pesadas na fixture.
    expect(totalPecas).toHaveLength(2);
  });

  // ── DoD 8.14 — RBAC AD-04 ────────────────────────────────────────────────────

  it('DoD 8.14 recorte AD-04 de permissões de estoque', async () => {
    const corte = await createTestUser(app, { perfil: 'corte' });
    const expedicao = await createTestUser(app, { perfil: 'expedicao' });
    const cookiesCorte = await loginCookies(app, corte.adminEmail, corte.adminPassword);
    const cookiesExpedicao = await loginCookies(app, expedicao.adminEmail, expedicao.adminPassword);

    const semPermissao = await request(app.getHttpServer()).get('/estoque/consulta').set('Cookie', cookiesCorte);
    expect(semPermissao.status).toBe(403);

    const comPermissao = await request(app.getHttpServer()).get('/estoque/consulta').set('Cookie', cookiesExpedicao);
    expect(comPermissao.status).toBe(200);

    await seedOperacaoAberta(db);
    const produtoId = await produtoCaixariaId(db);
    const entrada = await request(app.getHttpServer())
      .post('/estoque/entradas')
      .set('Cookie', cookiesExpedicao)
      .send({ produtoId, quantidade: 20, unidade: 'caixa', fornecedorNome: 'Frigorífico X', destino: 'estoque' });
    const criado = await request(app.getHttpServer())
      .post('/estoque/ajustes')
      .set('Cookie', cookiesExpedicao)
      .send({ tipo: 'entrada', id: entrada.body.id, quantidadeDelta: -8, motivo: 'erro_contagem' });

    // expedicao não tem ESTOQUE_AJUSTE_APROVAR (D8.1 — segregação de função).
    const aprovarSemPermissao = await request(app.getHttpServer())
      .post(`/estoque/ajustes/${criado.body.id}/aprovar`)
      .set('Cookie', cookiesExpedicao);
    expect(aprovarSemPermissao.status).toBe(403);
  });
});
