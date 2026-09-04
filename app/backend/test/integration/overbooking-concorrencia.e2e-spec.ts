import { INestApplication } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  cleanupDb,
  createTestApp,
  createTestUser,
  loginCookies,
} from '../helpers/test-app';
import { seedComercialBase, lerDisponibilidade } from '../helpers/comercial-fixtures';

describe('overbooking-concorrencia', () => {
  let app: INestApplication;
  let comercialCookies: string;
  let comprasCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function cenario(dataOperacao: string, quantidade: number) {
    const base = await seedComercialBase(app, { fator: 1 });
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao,
        fornecedorId: base.fornecedorId,
        itens: [{ produtoId: base.produtoCompraId, quantidadeComprada: quantidade }],
      });
    const compraId = criar.body.id as string;
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    return { base, compraId };
  }

  it('duas inclusões concorrentes do mesmo produtoId deixam uma linha', async () => {
    const { base, compraId } = await cenario('2026-12-01', 10);
    const outro = await seedComercialBase(app, { fator: 1 });

    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-12-01',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 1 }],
      })
      .expect(201);

    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .post(`/comercial/pedidos/${pedido.body.id}/itens/confirmar-overbooking`)
        .set('Cookie', comercialCookies)
        .send({ produtoId: outro.produtoId, quantidade: 2 }),
      request(app.getHttpServer())
        .post(`/comercial/pedidos/${pedido.body.id}/itens/confirmar-overbooking`)
        .set('Cookie', comercialCookies)
        .send({ produtoId: outro.produtoId, quantidade: 2 }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const { db } = app.get(DRIZZLE);
    const itens = await db.select().from(schema.pedidosVendaItens)
      .where(and(
        eq(schema.pedidosVendaItens.pedidoVendaId, pedido.body.id),
        eq(schema.pedidosVendaItens.produtoId, outro.produtoId),
        isNull(schema.pedidosVendaItens.deletedAt),
      ));
    expect(itens).toHaveLength(1);
  });

  it('concorrência no saldo não negativiza disponibilidade', async () => {
    const { base, compraId } = await cenario('2026-12-02', 2);
    const results = await Promise.all([
      request(app.getHttpServer())
        .post('/comercial/pedidos/confirmar-overbooking')
        .set('Cookie', comercialCookies)
        .send({
          compraProgramadaId: compraId,
          clienteId: base.clienteId,
          dataOperacao: '2026-12-02',
          itens: [{ produtoId: base.produtoId, quantidadePedida: 2 }],
        }),
      request(app.getHttpServer())
        .post('/comercial/pedidos/confirmar-overbooking')
        .set('Cookie', comercialCookies)
        .send({
          compraProgramadaId: compraId,
          clienteId: base.clienteId,
          dataOperacao: '2026-12-02',
          itens: [{ produtoId: base.produtoId, quantidadePedida: 2 }],
        }),
    ]);

    expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    const disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBeGreaterThanOrEqual(0);
    expect(Number(disp!.quantidadeReservada)).toBeLessThanOrEqual(2);
  });
});
