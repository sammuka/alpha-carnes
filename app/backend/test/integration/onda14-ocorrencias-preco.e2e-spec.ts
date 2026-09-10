import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  ocorrenciasAjustePreco,
  ocorrenciasAjustePrecoItens,
  pedidosVendaItens,
} from '../../src/database/schema';
import { EVENTOS } from '../../src/realtime/events/eventos';
import { RealtimeGateway } from '../../src/realtime/realtime.gateway';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';

type Db = NodePgDatabase<typeof schema>;

describe('Onda 14 — ocorrências ajuste preço na finalização (ALP-83)', () => {
  let app: INestApplication;
  let db: Db;
  let comercialCookies: string;
  let comprasCookies: string;
  let gestorCookies: string;
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

    base = await seedComercialBase(app);
    for (let d = 1; d <= 15; d += 1) {
      const data = `2026-12-${String(d).padStart(2, '0')}`;
      await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: data, quantidade: 100 });
    }
  }, 90_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function criarPedido(precoAplicado?: string) {
    seqData += 1;
    const dataOp = `2026-12-${String(seqData).padStart(2, '0')}`;
    if (seqData > 15) {
      await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dataOp, quantidade: 50 });
    }
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dataOp,
        itens: [{
          produtoId: base.produtoId,
          quantidadePedida: 2,
          ...(precoAplicado ? { precoAplicado } : {}),
        }],
      });
    if (res.status !== 201) throw new Error(`criar: ${res.status}`);
    return { id: res.body.id as string, dataOperacao: dataOp, itemId: res.body.itens?.[0]?.id as string };
  }

  it('14.6 finalizar com ajuste cria 1 ocorrência', async () => {
    const pedido = await criarPedido();
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedido.id)))[0]?.id;
    if (!itemId) throw new Error('item');
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '20.00' });
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/finalizar`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const ocorrs = await db.select().from(ocorrenciasAjustePreco)
      .where(eq(ocorrenciasAjustePreco.pedidoVendaId, pedido.id));
    expect(ocorrs).toHaveLength(1);
    expect(ocorrs[0]?.quantidadeItensAjustados).toBe(1);
    const linhas = await db.select().from(ocorrenciasAjustePrecoItens)
      .where(eq(ocorrenciasAjustePrecoItens.ocorrenciaId, ocorrs[0]!.id));
    expect(linhas).toHaveLength(1);
  });

  it('14.6b sem ajuste, 0 ocorrência', async () => {
    const pedido = await criarPedido();
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/finalizar`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const ocorrs = await db.select().from(ocorrenciasAjustePreco)
      .where(eq(ocorrenciasAjustePreco.pedidoVendaId, pedido.id));
    expect(ocorrs).toHaveLength(0);
  });

  it('14.6c ajuste desfeito (voltar ao original) → 0 ocorrência', async () => {
    const pedido = await criarPedido();
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedido.id)))[0]?.id;
    if (!itemId) throw new Error('item');
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '20.00' });
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '18.50' });
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/finalizar`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const ocorrs = await db.select().from(ocorrenciasAjustePreco)
      .where(eq(ocorrenciasAjustePreco.pedidoVendaId, pedido.id));
    expect(ocorrs).toHaveLength(0);
  });

  it('C8 desconto gera diferenca_total negativa e diferenca_percentual -8.1081', async () => {
    const pedido = await criarPedido();
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedido.id)))[0]?.id;
    if (!itemId) throw new Error('item');
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '17.00' });
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/finalizar`)
      .set('Cookie', gestorCookies);
    const [oc] = await db.select().from(ocorrenciasAjustePreco)
      .where(eq(ocorrenciasAjustePreco.pedidoVendaId, pedido.id));
    expect(Number(oc?.diferencaTotal)).toBeLessThan(0);
    const [linha] = await db.select().from(ocorrenciasAjustePrecoItens)
      .where(eq(ocorrenciasAjustePrecoItens.ocorrenciaId, oc!.id));
    expect(String(linha?.diferencaPercentual)).toBe('-8.1081');
    expect(String(linha?.diferencaPercentual)).not.toBe('-0.0811');
  });

  it('C7 original NULL → diferenca_percentual null', async () => {
    const dataOp = '2026-12-20';
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dataOp, quantidade: 50, publicarTabela: false });
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dataOp,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 1, precoAplicado: '15.00' }],
      });
    expect(res.status).toBe(201);
    const pedidoId = res.body.id as string;
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedidoId)))[0]?.id;
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedidoId}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '16.00' });
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedidoId}/finalizar`)
      .set('Cookie', gestorCookies);
    const [oc] = await db.select().from(ocorrenciasAjustePreco)
      .where(eq(ocorrenciasAjustePreco.pedidoVendaId, pedidoId));
    const [linha] = await db.select().from(ocorrenciasAjustePrecoItens)
      .where(eq(ocorrenciasAjustePrecoItens.ocorrenciaId, oc!.id));
    expect(linha?.diferencaPercentual).toBeNull();
  });

  it('emite OCORRENCIA_AJUSTE_PRECO_CRIADA após commit', async () => {
    const emitter = app.get(EventEmitter2);
    const emitSpy = jest.spyOn(emitter, 'emit');
    const pedido = await criarPedido();
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedido.id)))[0]?.id;
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '19.00' });
    emitSpy.mockClear();
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/finalizar`)
      .set('Cookie', gestorCookies);
    expect(emitSpy).toHaveBeenCalledWith(
      EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA,
      expect.objectContaining({ pedidoVendaId: pedido.id }),
    );
    emitSpy.mockRestore();
  });

  it('gateway broadcast CRIADA para rooms da operação', async () => {
    const gateway = app.get(RealtimeGateway);
    const hub = (gateway as unknown as { hub: { broadcast: jest.Mock } }).hub;
    const broadcastSpy = jest.spyOn(hub, 'broadcast');
    const pedido = await criarPedido();
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedido.id)))[0]?.id;
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '19.50' });
    broadcastSpy.mockClear();
    await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/finalizar`)
      .set('Cookie', gestorCookies);
    expect(broadcastSpy).toHaveBeenCalledWith(
      expect.any(String),
      EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA,
      expect.objectContaining({ dataOperacao: pedido.dataOperacao }),
    );
    broadcastSpy.mockRestore();
  });

  it('C5 finalização concorrente: uma 200, outra 409, uma ocorrência', async () => {
    const pedido = await criarPedido();
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedido.id)))[0]?.id;
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '21.00' });
    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/comercial/pedidos/${pedido.id}/finalizar`)
        .set('Cookie', gestorCookies),
      request(app.getHttpServer())
        .post(`/comercial/pedidos/${pedido.id}/finalizar`)
        .set('Cookie', gestorCookies),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const ocorrs = await db.select().from(ocorrenciasAjustePreco)
      .where(eq(ocorrenciasAjustePreco.pedidoVendaId, pedido.id));
    expect(ocorrs).toHaveLength(1);
  });

  it('C9 rollback da finalização → 0 ocorrência órfã e sem emit', async () => {
    const { AuditoriaService } = await import('../../src/common/auditoria/auditoria.service');
    const auditoria = app.get(AuditoriaService);
    const original = auditoria.registrar.bind(auditoria);
    const spy = jest.spyOn(auditoria, 'registrar').mockImplementation(async (tx, args) => {
      if (args.tabela === 'ocorrencias_ajuste_preco') {
        throw new Error('C9 abortar tx');
      }
      return original(tx, args);
    });
    const emitter = app.get(EventEmitter2);
    const emitSpy = jest.spyOn(emitter, 'emit');
    const pedido = await criarPedido();
    const itemId = (await db.select({ id: pedidosVendaItens.id }).from(pedidosVendaItens)
      .where(eq(pedidosVendaItens.pedidoVendaId, pedido.id)))[0]?.id;
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.id}/itens/${itemId}/preco`)
      .set('Cookie', comercialCookies)
      .send({ precoAplicado: '22.00' });
    emitSpy.mockClear();
    const res = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${pedido.id}/finalizar`)
      .set('Cookie', gestorCookies);
    expect(res.status).toBeGreaterThanOrEqual(400);
    const ocorrs = await db.select().from(ocorrenciasAjustePreco)
      .where(eq(ocorrenciasAjustePreco.pedidoVendaId, pedido.id));
    expect(ocorrs).toHaveLength(0);
    expect(emitSpy).not.toHaveBeenCalledWith(
      EVENTOS.OCORRENCIA_AJUSTE_PRECO_CRIADA,
      expect.anything(),
    );
    spy.mockRestore();
    emitSpy.mockRestore();
  });
});
