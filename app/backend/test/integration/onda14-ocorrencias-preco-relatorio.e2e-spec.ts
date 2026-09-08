import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  clientes,
  ocorrenciasAjustePreco,
  pedidosVendaItens,
  tabelasPreco,
  tabelasPrecoItens,
} from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';

type Db = NodePgDatabase<typeof schema>;

async function publicarTabela(
  db: Db,
  data: string,
  itens: Array<{ produtoId: string; precoA: string }>,
) {
  const [tab] = await db.insert(tabelasPreco).values({ data, status: 'publicada' }).returning();
  if (!tab) throw new Error('tabela');
  await db.insert(tabelasPrecoItens).values(itens.map((i) => ({
    tabelaPrecoId: tab.id,
    produtoId: i.produtoId,
    precoA: i.precoA,
    precoB: i.precoA,
    precoC: i.precoA,
    precoD: i.precoA,
  })));
}

describe('Onda 14 — GET /ocorrencias-preco/relatorio (ALP-85)', () => {
  let app: INestApplication;
  let db: Db;
  let comercialCookies: string;
  let comprasCookies: string;
  let gestorCookies: string;
  let base: Awaited<ReturnType<typeof seedComercialBase>>;
  let dataOp = '2026-12-30';

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
    await cleanupDb(app);

    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);

    base = await seedComercialBase(app);
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dataOp, quantidade: 100 });
    await publicarTabela(db, dataOp, [{ produtoId: base.produtoId, precoA: '18.50' }]);
  }, 90_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function finalizarComAjuste(precoPatch: string) {
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dataOp,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 2 }],
      });
    expect(res.status).toBe(201);
    const pedidoId = res.body.id as string;
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedidoId)))[0]?.id;
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedidoId}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: precoPatch });
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedidoId}/finalizar`)
      .set('Cookie', gestorCookies)
      .expect(200);
    return pedidoId;
  }

  it('403 sem APROVACOES_LER', async () => {
    await request(app.getHttpServer())
      .get('/ocorrencias-preco/relatorio?dataInicio=2026-12-01&dataFim=2026-12-31')
      .set('Cookie', comercialCookies)
      .expect(403);
  });

  it('400 sem dataInicio/dataFim', async () => {
    await request(app.getHttpServer())
      .get('/ocorrencias-preco/relatorio')
      .set('Cookie', gestorCookies)
      .expect(400);
  });

  it('C8 diferencaPercentual -8.1081 e valorTotalAjustado negativo', async () => {
    await finalizarComAjuste('17.00');
    const res = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/relatorio?dataInicio=${dataOp}&dataFim=${dataOp}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const pedido = res.body.data[0];
    expect(Number(pedido.valorTotalAjustado)).toBeLessThan(0);
    expect(pedido.itens[0].diferencaPercentual).toBe('-8.1081');
    expect(pedido.pedidoNumero).toBe(pedido.pedidoVendaId);
  });

  it('C7 diferencaPercentual null quando original null', async () => {
    const dataSemTabela = '2026-12-31';
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dataSemTabela, quantidade: 50 });
    const resPed = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dataSemTabela,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 1, precoAplicado: '15.00' }],
      });
    const pedidoId = resPed.body.id as string;
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedidoId)))[0]?.id;
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedidoId}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '16.00' });
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedidoId}/finalizar`)
      .set('Cookie', gestorCookies);
    const res = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/relatorio?dataInicio=${dataSemTabela}&dataFim=${dataSemTabela}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(res.body.data[0].itens[0].diferencaPercentual).toBeNull();
  });

  it('C10 cliente sem representante → representanteNome null', async () => {
    const res = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/relatorio?dataInicio=${dataOp}&dataFim=${dataOp}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(res.body.data[0]).toHaveProperty('representanteNome', null);
  });

  it('faixaPreco congelada do item, não do cliente atual', async () => {
    const pedidoId = await finalizarComAjuste('19.00');
    const [item] = await db.select({ faixaPreco: pedidosVendaItens.faixaPreco })
      .from(pedidosVendaItens).where(eq(pedidosVendaItens.pedidoVendaId, pedidoId));
    expect(item?.faixaPreco).toBe('A');
    await db.update(clientes).set({ faixaPreco: 'C' }).where(eq(clientes.id, base.clienteId));
    const resA = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/relatorio?dataInicio=${dataOp}&dataFim=${dataOp}&faixaPreco=A`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(resA.body.data.some((p: { pedidoVendaId: string }) => p.pedidoVendaId === pedidoId)).toBe(true);
    expect(resA.body.data.find((p: { pedidoVendaId: string }) => p.pedidoVendaId === pedidoId)?.faixaPreco).toBe('A');
    const resC = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/relatorio?dataInicio=${dataOp}&dataFim=${dataOp}&faixaPreco=C`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(resC.body.data.some((p: { pedidoVendaId: string }) => p.pedidoVendaId === pedidoId)).toBe(false);
  });

  it('republicação de tabela não altera relatório', async () => {
    const antes = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/relatorio?dataInicio=${dataOp}&dataFim=${dataOp}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    await db.execute(sql`UPDATE tabelas_preco_itens SET preco_a = '99.99' WHERE produto_id = ${base.produtoId}`);
    const depois = await request(app.getHttpServer())
      .get(`/ocorrencias-preco/relatorio?dataInicio=${dataOp}&dataFim=${dataOp}`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(depois.body).toEqual(antes.body);
  });
});
