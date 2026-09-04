import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, criarOutroCliente, pesarPeca, fakes, type CenarioPesagem } from '../helpers/pesagem-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Associação sugestiva e2e (sugerir/confirmar/redirecionar/sem-cobertura)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  }, 180000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

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
  });

  it('sugere quando há pedido compatível aberto (RF-PS-08) e NÃO vincula sozinho (RF-PS-09)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-08-01');
    await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId, dataOperacao: c.dataOperacao, quantidade: 5 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });

    const res = await request(srv()).get(`/operacao/pesagem/pecas/${pecaId}/sugestao`).set('Cookie', recebimentoCookies);
    expect(res.status).toBe(200);
    expect(res.body.sugestao).not.toBeNull();
    expect(res.body.sugestao.justificativa).toContain('item compatível');

    // RF-PS-09: a sugestão não alterou a peça (continua 'pesada', sem vínculo).
    const peca = await request(srv()).get(`/operacao/pesagem/pecas/${pecaId}`).set('Cookie', recebimentoCookies);
    expect(peca.body.statusPeca).toBe('pesada');
    expect(peca.body.pedidoVendaItemId).toBeNull();
  });

  it('confirmar incrementa quantidade_atendida e bloqueia item completo (409, RF-PS-17)', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-08-02');
    const { pedidoItemId } = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId, dataOperacao: c.dataOperacao, quantidade: 1 });

    const peca1 = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });
    const peca2 = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });

    const ok = await request(srv()).post(`/operacao/pesagem/pecas/${peca1}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: pedidoItemId });
    expect(ok.status).toBe(201);
    expect(ok.body.statusPeca).toBe('associada');

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const item = await db.select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pedidoItemId)).then((r) => r[0]!);
    expect(item.quantidadeAtendida).toBe('1.000');

    // Item já completo (pedida=1, atendida=1) → segunda peça recebe 409.
    const cheio = await request(srv()).post(`/operacao/pesagem/pecas/${peca2}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: pedidoItemId });
    expect(cheio.status).toBe(409);
  });

  it('REFINO 2 — concorrência: N peças no MESMO item com saldo limitado não excede pedida', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-08-03');
    const saldo = 3;
    const total = 6;
    const { pedidoItemId } = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId, dataOperacao: c.dataOperacao, quantidade: saldo });

    const pecasIds: string[] = [];
    for (let i = 0; i < total; i++) {
      pecasIds.push(await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId }));
    }

    // Confirma todas em paralelo no mesmo item.
    const resultados = await Promise.all(
      pecasIds.map((id) =>
        request(srv()).post(`/operacao/pesagem/pecas/${id}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: pedidoItemId }),
      ),
    );

    const sucessos = resultados.filter((r) => r.status === 201).length;
    const conflitos = resultados.filter((r) => r.status === 409).length;
    expect(sucessos).toBe(saldo);
    expect(conflitos).toBe(total - saldo);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const item = await db.select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pedidoItemId)).then((r) => r[0]!);
    expect(item.quantidadeAtendida).toBe('3.000'); // nunca excede a pedida
  });

  it('redirecionar devolve/consome saldo com histórico + auditoria', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-08-04');
    const pa = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId, dataOperacao: c.dataOperacao, quantidade: 2 });
    const pb = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: await criarOutroCliente(app), produtoId: c.produtoId, dataOperacao: c.dataOperacao, quantidade: 2 });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: pa.pedidoItemId });

    const redir = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/redirecionar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: pb.pedidoItemId, motivo: 'cliente A cancelou parte' });
    expect(redir.status).toBe(201);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const itemA = await db.select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pa.pedidoItemId)).then((r) => r[0]!);
    const itemB = await db.select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pb.pedidoItemId)).then((r) => r[0]!);
    expect(itemA.quantidadeAtendida).toBe('0.000'); // devolveu
    expect(itemB.quantidadeAtendida).toBe('1.000'); // consumiu

    const hist = await db.select().from(schema.associacoesPecaHistorico).where(eq(schema.associacoesPecaHistorico.pecaId, pecaId));
    expect(hist.some((h) => h.acao === 'redirecionar' && h.motivo === 'cliente A cancelou parte')).toBe(true);

    const audit = await db.select().from(schema.auditoria).where(eq(schema.auditoria.registroId, pecaId));
    expect(audit.length).toBeGreaterThanOrEqual(2); // confirmar + redirecionar
  });

  it('sem cobertura: sobra exige motivo; corte mantém vínculo; divergência abre ocorrência', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-08-05');

    // sobra sem motivo → 400
    const pecaSobra = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });
    const semMotivo = await request(srv()).post(`/operacao/pesagem/pecas/${pecaSobra}/sem-cobertura`).set('Cookie', recebimentoCookies).send({ destino: 'sobra' });
    expect(semMotivo.status).toBe(400);
    const comMotivo = await request(srv()).post(`/operacao/pesagem/pecas/${pecaSobra}/sem-cobertura`).set('Cookie', recebimentoCookies).send({ destino: 'sobra', motivo: 'sem pedido compatível' });
    expect(comMotivo.status).toBe(201);
    expect(comMotivo.body.statusPeca).toBe('em_sobra');

    // corte mantém vínculo rastreável (F4c)
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId, dataOperacao: c.dataOperacao, quantidade: 2 });
    const pecaCorte = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaCorte}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    const corte = await request(srv()).post(`/operacao/pesagem/pecas/${pecaCorte}/sem-cobertura`).set('Cookie', recebimentoCookies).send({ destino: 'corte' });
    expect(corte.status).toBe(201);
    expect(corte.body.statusPeca).toBe('para_corte');
    expect(corte.body.pedidoVendaItemId).toBe(p.pedidoItemId); // vínculo mantido

    // divergência abre ocorrência (reusa F4a)
    const pecaDiv = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });
    const div = await request(srv()).post(`/operacao/pesagem/pecas/${pecaDiv}/sem-cobertura`).set('Cookie', recebimentoCookies).send({
      destino: 'divergencia',
      // Tipologia canônica pós-0013 (legado qualidade_divergente → outro).
      divergencia: { tipo: 'outro', descricao: 'peça com problema visual', acaoImediata: 'separar para análise' },
    });
    expect(div.status).toBe(201);
    expect(div.body.statusPeca).toBe('divergente');

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const divs = await db.select().from(schema.divergenciasRecebimento).where(eq(schema.divergenciasRecebimento.recebimentoId, c.recebimentoId));
    expect(divs.some((d) => d.tipo === 'outro')).toBe(true);
  });

  it('peça inexistente: sugerir/confirmar → 404', async () => {
    const { default: request } = await import('supertest');
    const fake = '019ea000-0000-7000-8000-0000000000aa';
    const sug = await request(srv()).get(`/operacao/pesagem/pecas/${fake}/sugestao`).set('Cookie', recebimentoCookies);
    expect(sug.status).toBe(404);
    const conf = await request(srv()).post(`/operacao/pesagem/pecas/${fake}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: fake });
    expect(conf.status).toBe(404);
  });

  it('redirecionar peça não associada → 409; confirmar peça já associada → 409', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-08-08');
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId, dataOperacao: c.dataOperacao, quantidade: 3 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });

    // redirecionar antes de associar → 409
    const redirAntes = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/redirecionar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId, motivo: 'x' });
    expect(redirAntes.status).toBe(409);

    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    // confirmar de novo → 409 (já associada)
    const confDeNovo = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });
    expect(confDeNovo.status).toBe(409);

    // redirecionar para o mesmo item → 409
    const mesmoItem = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/redirecionar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId, motivo: 'x' });
    expect(mesmoItem.status).toBe(409);
  });

  it('sem cobertura: análise muda status e devolve saldo quando estava associada', async () => {
    const { default: request } = await import('supertest');
    const c = await cenario('2026-08-09');
    const p = await criarPedido(app, comercialCookies, { compraId: c.compraId, clienteId: c.clienteId, produtoId: c.produtoId, dataOperacao: c.dataOperacao, quantidade: 2 });
    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, produtoBaseId: c.produtoId });
    await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: p.pedidoItemId });

    const res = await request(srv()).post(`/operacao/pesagem/pecas/${pecaId}/sem-cobertura`).set('Cookie', recebimentoCookies).send({ destino: 'analise' });
    expect(res.status).toBe(201);
    expect(res.body.statusPeca).toBe('em_analise');
    expect(res.body.pedidoVendaItemId).toBeNull();

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const item = await db.select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, p.pedidoItemId)).then((r) => r[0]!);
    expect(item.quantidadeAtendida).toBe('0.000'); // devolveu o saldo
  });

  it('incompatível: confirmar item de outro item comercial → 409', async () => {
    const { default: request } = await import('supertest');
    // Cenário com 2 itens comerciais distintos exigiria outra base; aqui validamos
    // o caminho de incompatibilidade via item de pedido de outra compra.
    const c1 = await cenario('2026-08-06');
    const c2 = await cenario('2026-08-07');
    const pedidoC2 = await criarPedido(app, comercialCookies, { compraId: c2.compraId, clienteId: c2.clienteId, produtoId: c2.produtoId, dataOperacao: c2.dataOperacao, quantidade: 2 });
    const peca = await pesarPeca(app, recebimentoCookies, { recebimentoId: c1.recebimentoId, produtoBaseId: c1.produtoId });

    const res = await request(srv()).post(`/operacao/pesagem/pecas/${peca}/confirmar`).set('Cookie', recebimentoCookies).send({ pedidoVendaItemId: pedidoC2.pedidoItemId });
    expect(res.status).toBe(409); // pedido de outra compra/item
  });

  it('Onda 11: pecas dos lotes 001 e 002 da mesma operacao associam ao mesmo pedido', async () => {
    const { default: request } = await import('supertest');
    const {
      criarCompraConfirmada,
      criarPedidoFornecedorEnviado,
      iniciarRecebimentoViaPf,
    } = await import('../helpers/comercial-fixtures');
    const dia = '2026-12-27';
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: dia, quantidade: 6 },
    );
    const compra2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 4 });
    const pf2 = await criarPedidoFornecedorEnviado(app, comprasCookies, compra2);
    const { recebimentoId: rec2 } = await iniciarRecebimentoViaPf(app, recebimentoCookies, pf2);
    const pedido = await criarPedido(app, comercialCookies, {
      compraId: c1.compraId,
      clienteId: c1.clienteId,
      produtoId: c1.produtoId,
      dataOperacao: dia,
      quantidade: 10,
    });

    const idsLote001: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      idsLote001.push(await pesarPeca(app, recebimentoCookies, {
        recebimentoId: c1.recebimentoId,
        produtoBaseId: c1.produtoId,
      }));
    }
    const idsLote002: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      idsLote002.push(await pesarPeca(app, recebimentoCookies, {
        recebimentoId: rec2,
        produtoBaseId: c1.produtoId,
      }));
    }

    const sug1 = await request(srv()).get(`/operacao/pesagem/pecas/${idsLote001[0]}/sugestao`).set('Cookie', recebimentoCookies);
    const sug2 = await request(srv()).get(`/operacao/pesagem/pecas/${idsLote002[0]}/sugestao`).set('Cookie', recebimentoCookies);
    expect(sug1.status).toBe(200);
    expect(sug2.status).toBe(200);
    expect(sug1.body.compativeis.some((c: { pedidoVendaItemId: string }) => c.pedidoVendaItemId === pedido.pedidoItemId)).toBe(true);
    expect(sug2.body.compativeis.some((c: { pedidoVendaItemId: string }) => c.pedidoVendaItemId === pedido.pedidoItemId)).toBe(true);

    for (const pecaId of [...idsLote001, ...idsLote002]) {
      const ok = await request(srv())
        .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
        .set('Cookie', recebimentoCookies)
        .send({ pedidoVendaItemId: pedido.pedidoItemId });
      expect(ok.status).toBe(201);
    }

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const pecasPedido = await db.select().from(schema.pecas).where(eq(schema.pecas.pedidoVendaItemId, pedido.pedidoItemId));
    expect(pecasPedido).toHaveLength(10);
    expect(pecasPedido.filter((p) => p.compraProgramadaId === c1.compraId)).toHaveLength(6);
    expect(pecasPedido.filter((p) => p.compraProgramadaId === compra2)).toHaveLength(4);
    expect(pecasPedido.every((p) => p.compraProgramadaId != null)).toBe(true);

    const item = await db.select().from(schema.pedidosVendaItens).where(eq(schema.pedidosVendaItens.id, pedido.pedidoItemId)).then((r) => r[0]!);
    expect(item.quantidadeAtendida).toBe('10.000');

    const composicao = await request(srv())
      .get(`/comercial/pedidos/${pedido.pedidoId}/composicao-lotes`)
      .set('Cookie', comercialCookies);
    expect(composicao.status).toBe(200);
    expect(composicao.body).toEqual(expect.arrayContaining([
      expect.objectContaining({
        quantidadeUnidades: 6,
        compraProgramadaId: c1.compraId,
        recebimentoId: c1.recebimentoId,
      }),
      expect.objectContaining({
        quantidadeUnidades: 4,
        compraProgramadaId: compra2,
        recebimentoId: rec2,
      }),
    ]));
  }, 120000);

  it('Onda 11: associacao interoperacao retorna mensagem exata', async () => {
    const { default: request } = await import('supertest');
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: '2026-12-28', quantidade: 6 },
    );
    const c2 = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: '2026-12-29', quantidade: 6 },
    );
    const pedidoOutraOp = await criarPedido(app, comercialCookies, {
      compraId: c2.compraId,
      clienteId: c2.clienteId,
      produtoId: c2.produtoId,
      dataOperacao: c2.dataOperacao,
      quantidade: 2,
    });
    const peca = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c1.recebimentoId,
      produtoBaseId: c1.produtoId,
    });
    const sug = await request(srv()).get(`/operacao/pesagem/pecas/${peca}/sugestao`).set('Cookie', recebimentoCookies);
    expect(sug.body.compativeis.every((c: { pedidoVendaItemId: string }) => c.pedidoVendaItemId !== pedidoOutraOp.pedidoItemId)).toBe(true);

    const res = await request(srv())
      .post(`/operacao/pesagem/pecas/${peca}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: pedidoOutraOp.pedidoItemId });
    expect(res.status).toBe(409);
    const msg = res.body.message;
    expect(typeof msg === 'string' ? msg : msg.message).toBe('Pedido pertence a outra operação');
  });
});
