import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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

describe('overbooking-lifecycle', () => {
  let app: INestApplication;
  let comercialCookies: string;
  let comprasCookies: string;
  let gestorCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('detalhar pendência inclui histórico', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-12-10',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 1 }],
      });
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${criar.body.id}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();

    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: criar.body.id,
        clienteId: base.clienteId,
        dataOperacao: '2026-12-10',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 5 }],
      })
      .expect(201);

    const { db } = app.get(DRIZZLE);
    const [pend] = await db.select().from(schema.pendenciasOverbooking)
      .where(eq(schema.pendenciasOverbooking.pedidoVendaId, pedido.body.id));
    if (!pend) throw new Error('pendência ausente');

    const detalhe = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pend.id}`)
      .set('Cookie', comercialCookies)
      .expect(200);
    expect(detalhe.body.historico?.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .patch(`/comercial/overbooking/${pend.id}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'em_analise', detalhe: { nota: 'analisando' } })
      .expect(200);
  });
});
