import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, lerDisponibilidade } from '../helpers/comercial-fixtures';
import { challengePayload } from '../helpers/overbooking-fixtures';
import { EVENTOS } from '../../src/realtime/events/eventos';

/** Segundo cliente independente, usado onde o AD-03 (Onda 4) impede reusar o mesmo
 * cliente/item/operação de outro pedido aberto no mesmo cenário de teste. */
async function criarOutroCliente(app: INestApplication): Promise<string> {
  const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
  const sufixo = `${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
  const [cliente] = await db.insert(schema.clientes).values({
    codigo: `CLI2-${sufixo}`,
    razaoSocial: 'Cliente Reserva 2',
    documentoFiscal: `DOC2-${sufixo}`,
  }).returning();
  if (!cliente) throw new Error('Falha ao criar segundo cliente do teste');
  return cliente.id;
}

describe('Pedidos e2e (reserva atômica, parcial, liberação, rastreabilidade)', () => {
  let app: INestApplication;
  let comercialCookies: string;
  let comprasCookies: string;
  let recebimentoCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const recebimento = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    recebimentoCookies = await loginCookies(app, recebimento.adminEmail, recebimento.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function cenarioComSaldo(dataOperacao: string, fator: number, quantidade: number) {
    const base = await seedComercialBase(app, { fator });
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

  it('reserva total: pedida <= disponível decrementa o saldo', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-01', 1, 10);
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-01',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 4 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('em_elaboracao_reserva_ativa');

    const disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(6);
    expect(Number(disp!.quantidadeReservada)).toBe(4);
    expect(disp!.status).toBe('parcialmente_reservada');
  });

  it('RBAC: recebimento_pesagem (sem PEDIDOS_GERENCIAR) recebe 403', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-02', 1, 10);
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', recebimentoCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-02',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 1 }],
      });
    expect(res.status).toBe(403);
  });

  it('AD-05: pedida > disponível sem confirmação → 409 challenge sem mutação', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-03', 1, 5);
    const antes = await lerDisponibilidade(app, base.produtoId);

    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-03',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 8 }],
      });
    expect(res.status).toBe(409);
    const payload = challengePayload(res.body);
    expect(payload.code).toBe('OVERBOOKING_CONFIRMACAO_NECESSARIA');

    const depois = await lerDisponibilidade(app, base.produtoId);
    expect(depois).toEqual(antes);
  });

  it('AD-05: confirmar-overbooking com saldo parcial → 201 + pendência overbooking', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-13', 1, 5);
    const emitter = app.get(EventEmitter2);
    const overbookingEvt = new Promise<{ pedidoVendaId: string }>((resolve) => {
      emitter.once(EVENTOS.OVERBOOKING_CONFIRMADO, (p) => resolve(p));
    });

    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-13',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 8 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('em_elaboracao_reserva_ativa');

    const detalhe = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${res.body.id}`)
      .set('Cookie', comercialCookies);
    const item = detalhe.body.itens[0];
    expect(Number(item.quantidadeReservada)).toBe(5);
    expect(Number(item.quantidadeOverbooking)).toBe(3);
    expect(item.status).toBe('overbooking_confirmado');

    const disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(0);
    expect(disp!.status).toBe('esgotada');

    const evt = await overbookingEvt;
    expect(evt.pedidoVendaId).toBe(res.body.id);
  });

  it('AD-05: saldo ZERO sem confirmação → 409; com confirmação → overbooking 100%', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-04', 1, 3);
    await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-04',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 3 }],
      })
      .expect(201);

    // Onda 4 / AD-03: o pedido aberto é único por (cliente, item, operação); o saldo
    // zerado é exercitado aqui por um segundo cliente disputando o mesmo item/operação.
    const outroClienteId = await criarOutroCliente(app);
    const challenge = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: outroClienteId,
        dataOperacao: '2026-10-04',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 2 }],
      });
    expect(challenge.status).toBe(409);
    expect(challengePayload(challenge.body).code).toBe('OVERBOOKING_CONFIRMACAO_NECESSARIA');

    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: outroClienteId,
        dataOperacao: '2026-10-04',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 2 }],
      });
    expect(res.status).toBe(201);
    const detalhe = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${res.body.id}`)
      .set('Cookie', comercialCookies);
    const item = detalhe.body.itens[0];
    expect(Number(item.quantidadeReservada)).toBe(0);
    expect(Number(item.quantidadeOverbooking)).toBe(2);
    expect(item.status).toBe('overbooking_confirmado');

    const disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(0);
  });

  it('LIBERAÇÃO: cancelar pedido devolve o saldo à disponibilidade', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-05', 1, 10);
    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-05',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 7 }],
      });
    let disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(3);

    const cancelar = await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${pedido.body.id}`)
      .set('Cookie', comercialCookies)
      .send({ motivo: 'Cliente desistiu' });
    expect(cancelar.status).toBe(200);

    disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(10);
    expect(Number(disp!.quantidadeReservada)).toBe(0);
    expect(disp!.status).toBe('gerada');
  });

  it('REDUZIR item devolve a diferença ao saldo', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-06', 1, 10);
    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-06',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 8 }],
      });
    const itemId = (
      await request(app.getHttpServer()).get(`/comercial/pedidos/${pedido.body.id}`).set('Cookie', comercialCookies)
    ).body.itens[0].id;

    const reduzir = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.body.id}/itens/${itemId}`)
      .set('Cookie', comercialCookies)
      .send({ novaQuantidade: 3, motivo: 'Ajuste comercial' });
    expect(reduzir.status).toBe(200);

    const disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(7);
    expect(Number(disp!.quantidadeReservada)).toBe(3);
  });

  it('listar pedidos retorna paginado; detalhar inexistente → 404', async () => {
    const lista = await request(app.getHttpServer())
      .get('/comercial/pedidos?page=1&pageSize=10')
      .set('Cookie', comercialCookies);
    expect(lista.status).toBe(200);
    expect(Array.isArray(lista.body.data)).toBe(true);

    const inexistente = await request(app.getHttpServer())
      .get('/comercial/pedidos/019e0000-0000-7000-8000-0000000000bb')
      .set('Cookie', comercialCookies);
    expect(inexistente.status).toBe(404);
  });

  it('reduzir item: novaQuantidade >= reservada → 409; pedido inexistente → 404', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-08', 1, 10);
    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-08',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 5 }],
      });
    const itemId = (
      await request(app.getHttpServer()).get(`/comercial/pedidos/${pedido.body.id}`).set('Cookie', comercialCookies)
    ).body.itens[0].id;

    const aumentar = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.body.id}/itens/${itemId}`)
      .set('Cookie', comercialCookies)
      .send({ novaQuantidade: 9, motivo: 'Tentativa de aumento' });
    expect(aumentar.status).toBe(409);

    const pedidoInexistente = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/019e0000-0000-7000-8000-0000000000cc/itens/${itemId}`)
      .set('Cookie', comercialCookies)
      .send({ novaQuantidade: 1, motivo: 'Ajuste' });
    expect(pedidoInexistente.status).toBe(404);
  });

  it('remover item libera a reserva inteira e devolve todo o saldo', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-10', 1, 10);
    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-10',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 6 }],
      });
    const itemId = (
      await request(app.getHttpServer()).get(`/comercial/pedidos/${pedido.body.id}`).set('Cookie', comercialCookies)
    ).body.itens[0].id;

    const remover = await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${pedido.body.id}/itens/${itemId}`)
      .set('Cookie', comercialCookies)
      .send({ motivo: 'Item cancelado' });
    expect(remover.status).toBe(200);

    const disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(10);
    expect(Number(disp!.quantidadeReservada)).toBe(0);
    expect(disp!.status).toBe('gerada');
  });

  it('cancelar pedido já cancelado → 409', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-09', 1, 10);
    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-09',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 2 }],
      });
    const primeira = await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${pedido.body.id}`)
      .set('Cookie', comercialCookies)
      .send({ motivo: 'Primeiro cancelamento' });
    expect(primeira.status).toBe(200);
    const segunda = await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${pedido.body.id}`)
      .set('Cookie', comercialCookies)
      .send({ motivo: 'Segundo cancelamento' });
    expect(segunda.status).toBe(409);
  });

  it('RASTREABILIDADE: pedido → cliente → item → disponibilidade → preferências', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-07', 1, 10);
    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-07',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 2 }],
      });
    const detalhe = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${pedido.body.id}`)
      .set('Cookie', comercialCookies);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.cliente.id).toBe(base.clienteId);
    const item = detalhe.body.itens[0];
    expect(item.produto.id).toBe(base.produtoId);
    expect(item.reservas[0].disponibilidade.produtoId).toBe(base.produtoId);
    expect(item).toHaveProperty('preferenciasAplicadasJson');
  });

  it('Onda 11: pedido com operacaoId e sem compra persiste compraProgramadaId NULL', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-23', 1, 10);
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const [compra] = await db.select({ operacaoId: schema.comprasProgramadas.operacaoId })
      .from(schema.comprasProgramadas)
      .where(eq(schema.comprasProgramadas.id, compraId));
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        operacaoId: compra!.operacaoId,
        clienteId: base.clienteId,
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 2 }],
      });
    expect(res.status).toBe(201);
    const [pedido] = await db.select()
      .from(schema.pedidosVenda)
      .where(eq(schema.pedidosVenda.id, res.body.id as string));
    expect(pedido!.compraProgramadaId).toBeNull();
    expect(pedido!.operacaoId).toBe(compra!.operacaoId);
  });

  it('Onda 11: compraProgramadaId legado e aceito e gravado como NULL', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-24', 1, 10);
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-12-24',
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 2 }],
      });
    expect(res.status).toBe(201);
    const [pedido] = await db.select()
      .from(schema.pedidosVenda)
      .where(eq(schema.pedidosVenda.id, res.body.id as string));
    expect(pedido!.compraProgramadaId).toBeNull();
  });

  it('Onda 11: reserva FIFO 6+4 atravessa duas compras; lote de outra operacao nao cobre', async () => {
    const dia = '2026-12-25';
    const base = await seedComercialBase(app, { fator: 1 });
    const criarConfirmada = async (data: string, qtd: number) => {
      const criar = await request(app.getHttpServer())
        .post('/comercial/compras-programadas')
        .set('Cookie', comprasCookies)
        .send({
          dataOperacao: data,
          fornecedorId: base.fornecedorId,
          itens: [{ produtoId: base.produtoCompraId, quantidadeComprada: qtd }],
        });
      expect(criar.status).toBe(201);
      const conf = await request(app.getHttpServer())
        .post(`/comercial/compras-programadas/${criar.body.id}/confirmar`)
        .set('Cookie', comprasCookies)
        .send();
      expect(conf.status).toBe(201);
      return criar.body.id as string;
    };
    await criarConfirmada(dia, 6);
    await criarConfirmada(dia, 4);
    await criarConfirmada('2026-12-26', 20);

    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dia,
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 10 }],
      });
    expect(pedido.status).toBe(201);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const itens = await db.select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.pedidoVendaId, pedido.body.id as string));
    const reservas = await db.select()
      .from(schema.reservasDisponibilidade)
      .where(eq(schema.reservasDisponibilidade.pedidoVendaItemId, itens[0]!.id));
    const idsVirtuais = reservas
      .map((r) => r.disponibilidadeVirtualId)
      .filter((id): id is string => id !== null);
    expect(new Set(idsVirtuais).size).toBe(2);
    expect(reservas.map((r) => Number(r.quantidadeReservada)).sort((a, b) => a - b)).toEqual([4, 6]);

    const outroClienteId = await criarOutroCliente(app);
    const challenge = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: outroClienteId,
        dataOperacao: dia,
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 1 }],
      });
    expect(challenge.status).toBe(409);
    expect(challengePayload(challenge.body).code).toBe('OVERBOOKING_CONFIRMACAO_NECESSARIA');

    const confirmado = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: outroClienteId,
        dataOperacao: dia,
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 1 }],
      });
    expect(confirmado.status).toBe(201);

    const duplicado = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId: base.clienteId,
        dataOperacao: dia,
        itens: [{ produtoId: base.produtoCompraId, quantidadePedida: 1 }],
      });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.code ?? duplicado.body.message).toBeDefined();
  });
});
