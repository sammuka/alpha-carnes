import { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  cleanupDb,
  createTestApp,
  createTestUser,
  loginCookies,
} from '../helpers/test-app';
import {
  criarCompraConfirmada,
  publicarTabelaParaData,
  seedComercialBase,
} from '../helpers/comercial-fixtures';

/**
 * AD-17 — quando uma nova compra (ou ajuste de quantidade de compra já confirmada)
 * aumenta o saldo do pool de disponibilidade virtual de um produto/operação, as
 * pendências de overbooking abertas do mesmo produto/operação (backlog multi-compra,
 * AD-14) devem ser abatidas automaticamente, sem exigir decisão manual do gestor.
 */
describe('overbooking-reconciliacao (AD-17 — reconciliação automática com o pool)', () => {
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

  async function pendenciaDoPedido(pedidoId: string) {
    const { db } = app.get(DRIZZLE);
    const [pend] = await db.select().from(schema.pendenciasOverbooking)
      .where(eq(schema.pendenciasOverbooking.pedidoVendaId, pedidoId));
    return pend ?? null;
  }

  async function itemDoPedido(pedidoId: string, produtoId: string) {
    const { db } = app.get(DRIZZLE);
    const [item] = await db.select().from(schema.pedidosVendaItens)
      .where(and(
        eq(schema.pedidosVendaItens.pedidoVendaId, pedidoId),
        eq(schema.pedidosVendaItens.produtoId, produtoId),
      ));
    return item ?? null;
  }

  it('nova compra confirmada na mesma operação abate automaticamente o déficit de overbooking', async () => {
    const dataOperacao = '2026-12-20';
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao, quantidade: 5 });
    await publicarTabelaParaData(app, dataOperacao, [base.produtoId]);

    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 8 }],
      })
      .expect(201);

    const pendenciaAberta = await pendenciaDoPedido(pedido.body.id);
    expect(pendenciaAberta).not.toBeNull();
    expect(pendenciaAberta!.status).toBe('aberta');
    expect(Number(pendenciaAberta!.quantidadeDeficit)).toBe(3);

    const itemAntes = await itemDoPedido(pedido.body.id, base.produtoId);
    expect(Number(itemAntes!.quantidadeReservada)).toBe(5);
    expect(Number(itemAntes!.quantidadeOverbooking)).toBe(3);
    expect(itemAntes!.status).toBe('overbooking_confirmado');

    // Segunda compra do mesmo fornecedor/produto para a mesma operação (AD-14):
    // cobre parcialmente o déficit (2 de 3) — a pendência permanece aberta com 1 restante.
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao, quantidade: 2 });

    const pendenciaParcial = await pendenciaDoPedido(pedido.body.id);
    expect(pendenciaParcial!.status).toBe('aberta');
    expect(Number(pendenciaParcial!.quantidadeDeficit)).toBe(1);

    const itemParcial = await itemDoPedido(pedido.body.id, base.produtoId);
    expect(Number(itemParcial!.quantidadeReservada)).toBe(7);
    expect(Number(itemParcial!.quantidadeOverbooking)).toBe(1);
    expect(itemParcial!.status).toBe('overbooking_confirmado');

    // Terceira compra cobre o restante — a pendência é resolvida automaticamente.
    await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao, quantidade: 1 });

    // chk_pend_ovb_deficit exige quantidade_deficit > 0: ao resolver, o último valor
    // positivo persistido é preservado (mesmo padrão do caminho manual de decisão).
    const pendenciaResolvida = await pendenciaDoPedido(pedido.body.id);
    expect(pendenciaResolvida!.status).toBe('resolvida');

    const itemFinal = await itemDoPedido(pedido.body.id, base.produtoId);
    expect(Number(itemFinal!.quantidadeReservada)).toBe(8);
    expect(Number(itemFinal!.quantidadeOverbooking)).toBe(0);
    expect(itemFinal!.status).toBe('totalmente_reservado');

    const historico = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pendenciaResolvida!.id}/historico`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(historico.body.some((h: { acao: string }) => h.acao === 'deficit_reduzido_automaticamente')).toBe(true);
    expect(historico.body.some((h: { acao: string }) => h.acao === 'resolvida')).toBe(true);
  });

  it('ajuste de quantidade em compra confirmada também reconcilia pendências abertas', async () => {
    const dataOperacao = '2026-12-21';
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao, quantidade: 4 });
    await publicarTabelaParaData(app, dataOperacao, [base.produtoId]);

    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao,
        itens: [{ produtoId: base.produtoId, quantidadePedida: 6 }],
      })
      .expect(201);

    const pendenciaAberta = await pendenciaDoPedido(pedido.body.id);
    expect(Number(pendenciaAberta!.quantidadeDeficit)).toBe(2);

    const { db } = app.get(DRIZZLE);
    const [item] = await db.select().from(schema.comprasProgramadasItens)
      .where(eq(schema.comprasProgramadasItens.compraProgramadaId, compraId));

    await request(app.getHttpServer())
      .patch(`/comercial/compras-programadas/${compraId}/itens/${item!.id}`)
      .set('Cookie', comprasCookies)
      .send({ quantidadeComprada: 6, confirmarDeficit: true })
      .expect(200);

    const pendenciaResolvida = await pendenciaDoPedido(pedido.body.id);
    expect(pendenciaResolvida!.status).toBe('resolvida');
  });
});
