import { INestApplication } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  auditoria,
  clientes,
  pedidosVendaItens,
  produtos,
  tabelasPreco,
  tabelasPrecoItens,
} from '../../src/database/schema';
import { AdendosService } from '../../src/modules/comercial/pedidos/adendos.service';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';

type Db = NodePgDatabase<typeof schema>;

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

async function publicarTabela(
  db: Db,
  data: string,
  itens: Array<{ produtoId: string; precoA: string; precoB?: string; precoC?: string; precoD?: string }>,
) {
  const [tab] = await db.insert(tabelasPreco).values({ data, status: 'publicada' }).returning();
  if (!tab) throw new Error('tabela');
  await db.insert(tabelasPrecoItens).values(itens.map((i) => ({
    tabelaPrecoId: tab.id,
    produtoId: i.produtoId,
    precoA: i.precoA,
    precoB: i.precoB ?? i.precoA,
    precoC: i.precoC ?? i.precoA,
    precoD: i.precoD ?? i.precoA,
  })));
  return tab.id;
}

describe('Onda 14 — preço no item do pedido (ALP-81)', () => {
  let app: INestApplication;
  let db: Db;
  let comercialCookies: string;
  let comprasCookies: string;
  let gestorCookies: string;
  let usuarioId: string;
  let base: Awaited<ReturnType<typeof seedComercialBase>>;
  let seqData = 0;

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

    const [usuario] = await db.select().from(schema.usuarios).limit(1);
    if (!usuario) throw new Error('usuario');
    usuarioId = usuario.id;

    base = await seedComercialBase(app);
    for (let d = 1; d <= 15; d += 1) {
      const data = `2026-10-${String(d).padStart(2, '0')}`;
      await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: data, quantidade: 100 });
      await publicarTabela(db, data, [{ produtoId: base.produtoId, precoA: '18.50', precoB: '19.00' }]);
    }
  }, 90_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function criarPedido(precoAplicado?: string, dataOperacao?: string) {
    seqData += 1;
    const dataOp = dataOperacao ?? `2026-10-${String(seqData).padStart(2, '0')}`;
    const body: Record<string, unknown> = {
      clienteId: base.clienteId,
      dataOperacao: dataOp,
      itens: [{ produtoId: base.produtoId, quantidadePedida: 2, ...(precoAplicado ? { precoAplicado } : {}) }],
    };
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send(body);
    if (res.status !== 201) throw new Error(`criar pedido: ${res.status} ${JSON.stringify(res.body)}`);
    const det = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${res.body.id}`)
      .set('Cookie', comercialCookies);
    return det.body as { id: string; itens: Array<{ id: string; precoAplicado: string; precoTabelaOriginal: string | null; precoAjustado?: boolean; unidadePreco?: string }> };
  }

  it('14.2 congela preço da faixa A na inclusão', async () => {
    const pedido = await criarPedido();
    const item = pedido.itens[0];
    expect(item?.precoTabelaOriginal).toMatch(/^18\.5(0)?$/);
    expect(item?.precoAplicado).toMatch(/^18\.5(0)?$/);
    const det = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${pedido.id}`)
      .set('Cookie', comercialCookies);
    expect(det.body.itens[0].precoAjustado).toBe(false);
  });

  it('14.3 PATCH preco acima e abaixo com auditoria', async () => {
    const pedido = await criarPedido();
    const itemId = pedido.itens[0]!.id;
    const patchAcima = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '20.00' });
    expect(patchAcima.status).toBe(200);
    expect(patchAcima.body.precoAplicado).toBe('20.00');

    const patchAbaixo = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '17.00' });
    expect(patchAbaixo.status).toBe(200);

    const [reg] = await db.select({ justificativa: auditoria.justificativa })
      .from(auditoria)
      .where(eq(auditoria.registroId, itemId))
      .orderBy(desc(auditoria.createdAt))
      .limit(1);
    expect(reg?.justificativa).toBe('pedido.item.preco_ajustado');
  });

  it('403 PATCH preco sem PEDIDOS_GERENCIAR', async () => {
    const pedido = await criarPedido();
    const res = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${pedido.itens[0]!.id}/preco`)
      .set('Cookie', comprasCookies)
      .send({ precoAplicado: '21.00' });
    expect(res.status).toBe(403);
  });

  it("400 preco '0' e '18.999'", async () => {
    const pedido = await criarPedido();
    const itemId = pedido.itens[0]!.id;
    const zero = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '0' });
    expect(zero.status).toBe(400);
    const casas = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '18.999' });
    expect(casas.status).toBe(400);
  });

  it('14.4b inclusão sem preço e sem tabela retorna 400', async () => {
    const dataSemTab = '2026-10-30';
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dataSemTab, quantidade: 50 });
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dataSemTab,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 1 }],
      });
    expect(res.status).toBe(400);
  });

  it('C1 sem vigente persiste unidade do catálogo com preço manual', async () => {
    const dataSemTab = '2026-10-31';
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dataSemTab, quantidade: 50 });
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dataSemTab,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 1, precoAplicado: '12.50' }],
      });
    expect(res.status).toBe(201);
    const det = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${res.body.id}`)
      .set('Cookie', comercialCookies);
    expect(det.body.itens[0].unidadePreco).toBe('kg');
    expect(det.body.itens[0].precoTabelaOriginal).toBeNull();
  });

  it('14.5 republicar tabela não altera item congelado', async () => {
    const dataOp = '2026-10-11';
    const pedido = await criarPedido(undefined, dataOp);
    const itemId = pedido.itens[0]!.id;
    const [tab] = await db.select().from(tabelasPreco).where(eq(tabelasPreco.data, dataOp)).limit(1);
    if (!tab) throw new Error('tab');
    await db.update(tabelasPrecoItens)
      .set({ precoA: '99.00' })
      .where(and(eq(tabelasPrecoItens.tabelaPrecoId, tab.id), eq(tabelasPrecoItens.produtoId, base.produtoId)));
    const [item] = await db.select().from(pedidosVendaItens).where(eq(pedidosVendaItens.id, itemId));
    expect(item?.precoAplicado).toMatch(/^18\.5(0)?$/);
  });

  it('14.5b mudar faixa do cliente não altera item', async () => {
    const pedido = await criarPedido();
    const itemId = pedido.itens[0]!.id;
    await db.update(clientes).set({ faixaPreco: 'C' }).where(eq(clientes.id, base.clienteId));
    const [item] = await db.select().from(pedidosVendaItens).where(eq(pedidosVendaItens.id, itemId));
    expect(item?.faixaPreco).toBe('A');
    expect(item?.precoAplicado).toMatch(/^18\.5(0)?$/);
  });

  it('409 PATCH em pedido finalizado', async () => {
    const pedido = await criarPedido();
    const itemId = pedido.itens[0]!.id;
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/finalizar`)
      .set('Cookie', gestorCookies);
    const res = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '22.00' });
    expect(res.status).toBe(409);
  });

  it('C6 adendo herda preço ajustado', async () => {
    const pedido = await criarPedido();
    const itemId = pedido.itens[0]!.id;
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '20.50' });
    const adendos = app.get(AdendosService);
    await adendos.registrar(pedido.id, {
      produtoId: base.produtoId,
      quantidadeAdicionada: 1,
      motivo: 'Cliente pediu mais',
    }, usuarioId, false);
    const [item] = await db.select().from(pedidosVendaItens).where(eq(pedidosVendaItens.id, itemId));
    expect(item?.precoAplicado).toBe('20.50');
    expect(item?.precoTabelaOriginal).toMatch(/^18\.5(0)?$/);
  });
});
