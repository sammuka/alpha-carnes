import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  cleanupDb,
  createTestApp,
  createTestUser,
  loginCookies,
} from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';

describe('pedido-fornecedor (Pedido ao Fornecedor + NF)', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let recebimentoCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    // Expande: remove unicidade legada que impede N recebimentos (contract 0014).
    const { db } = app.get(DRIZZLE);
    await db.execute(sql`DROP INDEX IF EXISTS uq_recebimentos_compra`);

    const compras = await createTestUser(app, { perfil: 'compras' });
    const recebimento = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    recebimentoCookies = await loginCookies(app, recebimento.adminEmail, recebimento.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function compraConfirmada(dataOperacao: string) {
    const base = await seedComercialBase(app, { fator: 1 });
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao,
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 5 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${criar.body.id}/confirmar`)
      .set('Cookie', comprasCookies)
      .send()
      .expect(201);
    return { base, compraId: criar.body.id as string };
  }

  async function pedidoPronto(dataOperacao: string) {
    const { base, compraId } = await compraConfirmada(dataOperacao);
    const pedido = await request(app.getHttpServer())
      .post('/operacao/pedidos-fornecedor')
      .set('Cookie', comprasCookies)
      .send({ compraProgramadaId: compraId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/operacao/pedidos-fornecedor/${pedido.body.id}/enviar`)
      .set('Cookie', comprasCookies)
      .send()
      .expect(200);
    return { base, compraId, pedidoId: pedido.body.id as string, operacaoId: pedido.body.operacaoId as string };
  }

  it('recebimento sem PEDIDO_FORNECEDOR_GERENCIAR recebe 403', async () => {
    const { compraId } = await compraConfirmada('2026-08-05');
    const res = await request(app.getHttpServer())
      .post('/operacao/pedidos-fornecedor')
      .set('Cookie', recebimentoCookies)
      .send({ compraProgramadaId: compraId });
    expect(res.status).toBe(403);
  });

  it('cria pedido espelhando disponibilidade da compra confirmada', async () => {
    const { base, compraId } = await compraConfirmada('2026-08-01');

    const res = await request(app.getHttpServer())
      .post('/operacao/pedidos-fornecedor')
      .set('Cookie', comprasCookies)
      .send({ compraProgramadaId: compraId })
      .expect(201);

    expect(res.body.status).toBe('rascunho');
    expect(res.body.compraProgramadaId).toBe(compraId);
    expect(res.body.fornecedorId).toBe(base.fornecedorId);

    const detalhe = await request(app.getHttpServer())
      .get(`/operacao/pedidos-fornecedor/${res.body.id}`)
      .set('Cookie', recebimentoCookies)
      .expect(200);
    expect(detalhe.body.itens.length).toBeGreaterThanOrEqual(1);
    expect(detalhe.body.itens[0].itemComercialId).toBe(base.itemComercialId);

    // compra não confirmada
    const rascunho = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-08-02',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 1 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/operacao/pedidos-fornecedor')
      .set('Cookie', comprasCookies)
      .send({ compraProgramadaId: rascunho.body.id })
      .expect(409);
  });

  it('recebimento exige pedido enviado; permite N recebimentos e N NFs no mesmo recebimento', async () => {
    const { base, pedidoId, operacaoId } = await pedidoPronto('2026-08-03');

    // sem enviar (novo rascunho)
    const { compraId: cRasc } = await compraConfirmada('2026-08-04');
    const rasc = await request(app.getHttpServer())
      .post('/operacao/pedidos-fornecedor')
      .set('Cookie', comprasCookies)
      .send({ compraProgramadaId: cRasc })
      .expect(201);
    await request(app.getHttpServer())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: rasc.body.id })
      .expect(409);

    const r1 = await request(app.getHttpServer())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: pedidoId })
      .expect(201);
    expect(r1.body.recebimento.status).toBe('pesagem_em_andamento');
    expect(r1.body.recebimento.pedidoFornecedorId).toBe(pedidoId);

    const r2 = await request(app.getHttpServer())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: pedidoId })
      .expect(201);
    expect(r2.body.recebimento.id).not.toBe(r1.body.recebimento.id);

    const recId = r1.body.recebimento.id as string;

    const nf1 = await request(app.getHttpServer())
      .post(`/operacao/pedidos-fornecedor/${pedidoId}/nf`)
      .set('Cookie', recebimentoCookies)
      .send({
        numero: '1001',
        recebimentoId: recId,
        itens: [{ itemComercialId: base.itemComercialId, quantidadeDeclarada: 5 }],
      })
      .expect(201);

    const nf2 = await request(app.getHttpServer())
      .post(`/operacao/pedidos-fornecedor/${pedidoId}/nf`)
      .set('Cookie', recebimentoCookies)
      .send({
        numero: '1002',
        recebimentoId: recId,
        itens: [{ itemComercialId: base.itemComercialId, quantidadeDeclarada: 3 }],
      })
      .expect(201);

    expect(nf1.body.id).not.toBe(nf2.body.id);

    const { db } = app.get(DRIZZLE);
    const nfs = await db.select().from(schema.notasFiscaisFornecedor)
      .where(eq(schema.notasFiscaisFornecedor.recebimentoId, recId));
    expect(nfs.length).toBe(2);
    expect(nfs.every((nf: { deletedAt: Date | null }) => nf.deletedAt === null)).toBe(true);

    const lista = await request(app.getHttpServer())
      .get('/operacao/pedidos-fornecedor')
      .query({ operacaoId })
      .set('Cookie', recebimentoCookies)
      .expect(200);
    expect(lista.body.data.some((p: { id: string }) => p.id === pedidoId)).toBe(true);
  });

  it('lista explicitamente Pedidos ao Fornecedor elegiveis para recebimento', async () => {
    const { db } = app.get(DRIZZLE);
    const enviado = await pedidoPronto('2026-08-11');
    await db.update(schema.pedidosFornecedor)
      .set({ status: 'enviado' })
      .where(eq(schema.pedidosFornecedor.id, enviado.pedidoId));
    const aguardando = await pedidoPronto('2026-08-12');
    const recebido = await pedidoPronto('2026-08-13');
    await db.update(schema.pedidosFornecedor)
      .set({ status: 'recebido' })
      .where(eq(schema.pedidosFornecedor.id, recebido.pedidoId));
    const rascunho = await pedidoPronto('2026-08-16');
    await db.update(schema.pedidosFornecedor)
      .set({ status: 'rascunho' })
      .where(eq(schema.pedidosFornecedor.id, rascunho.pedidoId));
    const encerrado = await pedidoPronto('2026-08-17');
    await db.update(schema.pedidosFornecedor)
      .set({ status: 'encerrado' })
      .where(eq(schema.pedidosFornecedor.id, encerrado.pedidoId));
    const cancelado = await pedidoPronto('2026-08-18');
    await db.update(schema.pedidosFornecedor)
      .set({ status: 'cancelado' })
      .where(eq(schema.pedidosFornecedor.id, cancelado.pedidoId));
    const comLoteAtivo = await pedidoPronto('2026-08-14');
    await request(app.getHttpServer())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: comLoteAtivo.pedidoId })
      .expect(201);
    const comLoteCancelado = await pedidoPronto('2026-08-15');
    const loteCancelado = await request(app.getHttpServer())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ pedidoFornecedorId: comLoteCancelado.pedidoId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/operacao/recebimentos/${loteCancelado.body.recebimento.id}/cancelar`)
      .set('Cookie', recebimentoCookies)
      .send()
      .expect(201);

    const lista = await request(app.getHttpServer())
      .get('/operacao/pedidos-fornecedor?elegiveisRecebimento=true&pagina=1&limite=100')
      .set('Cookie', recebimentoCookies)
      .expect(200);
    const ids = new Set((lista.body.data as Array<{ id: string }>).map((pedido) => pedido.id));
    expect(ids.has(enviado.pedidoId)).toBe(true);
    expect(ids.has(aguardando.pedidoId)).toBe(true);
    expect(ids.has(comLoteCancelado.pedidoId)).toBe(true);
    expect(ids.has(recebido.pedidoId)).toBe(false);
    expect(ids.has(rascunho.pedidoId)).toBe(false);
    expect(ids.has(encerrado.pedidoId)).toBe(false);
    expect(ids.has(cancelado.pedidoId)).toBe(false);
    expect(ids.has(comLoteAtivo.pedidoId)).toBe(false);
    expect(lista.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: enviado.pedidoId,
        fornecedorId: enviado.base.fornecedorId,
        operacaoId: enviado.operacaoId,
        compraProgramadaId: enviado.compraId,
        dataOperacao: '2026-08-11',
      }),
    ]));
    expect(lista.body.data.every((pedido: { status: string }) =>
      ['enviado', 'aguardando_recebimento'].includes(pedido.status))).toBe(true);

    await request(app.getHttpServer())
      .get(`/operacao/pedidos-fornecedor?elegiveisRecebimento=true&operacaoId=${enviado.operacaoId}`)
      .set('Cookie', recebimentoCookies)
      .expect(400);
    await request(app.getHttpServer())
      .get('/operacao/pedidos-fornecedor?elegiveisRecebimento=true&status=enviado')
      .set('Cookie', recebimentoCookies)
      .expect(400);
  });
});
