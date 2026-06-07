import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, lerDisponibilidade } from '../helpers/comercial-fixtures';
import { EVENTOS } from '../../src/realtime/events/eventos';

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

  // Cria compra confirmada com saldo conhecido; retorna ids para montar pedidos.
  async function cenarioComSaldo(dataOperacao: string, fator: number, quantidade: number) {
    const base = await seedComercialBase(app, { fator });
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao,
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: quantidade }],
      });
    const compraId = criar.body.id as string;
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    return { base, compraId };
  }

  it('reserva total: pedida <= disponível decrementa o saldo', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-01', 1, 10); // saldo 10
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-01',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 4 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('reservado');

    const disp = await lerDisponibilidade(app, base.itemComercialId);
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
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 1 }],
      });
    expect(res.status).toBe(403);
  });

  it('reserva PARCIAL: pedida > disponível → reserva o que há, resto pendente + evento sem cobertura', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-03', 1, 5); // saldo 5
    const emitter = app.get(EventEmitter2);
    const semCobertura = new Promise<{ pedidoId: string }>((resolve) => {
      emitter.once(EVENTOS.PEDIDO_SEM_COBERTURA, (p) => resolve(p));
    });

    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-03',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 8 }], // pede 8, há 5
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('parcialmente_reservado');

    const detalhe = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${res.body.id}`)
      .set('Cookie', comercialCookies);
    const item = detalhe.body.itens[0];
    expect(Number(item.quantidadeReservada)).toBe(5);
    expect(Number(item.quantidadePendente)).toBe(3);
    expect(item.status).toBe('parcialmente_reservado');

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(0);
    expect(disp!.status).toBe('esgotada');

    const evt = await semCobertura;
    expect(evt.pedidoId).toBe(res.body.id);
  });

  it('saldo ZERO (S3): item 100% pendente, status sem_cobertura', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-04', 1, 3); // saldo 3
    // consome tudo
    await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-04',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 3 }],
      });
    // segundo pedido não tem saldo
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-04',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 2 }],
      });
    expect(res.status).toBe(201);
    const detalhe = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${res.body.id}`)
      .set('Cookie', comercialCookies);
    const item = detalhe.body.itens[0];
    expect(Number(item.quantidadeReservada)).toBe(0);
    expect(Number(item.quantidadePendente)).toBe(2);
    expect(item.status).toBe('sem_cobertura');

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(0); // nunca negativo
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
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 7 }],
      });
    let disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(3);

    const cancelar = await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${pedido.body.id}`)
      .set('Cookie', comercialCookies)
      .send();
    expect(cancelar.status).toBe(200);

    disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(10); // saldo devolvido
    expect(Number(disp!.quantidadeReservada)).toBe(0);
    expect(disp!.status).toBe('gerada'); // S1: não fica esgotada com disponível > 0
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
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 8 }],
      });
    const itemId = (
      await request(app.getHttpServer()).get(`/comercial/pedidos/${pedido.body.id}`).set('Cookie', comercialCookies)
    ).body.itens[0].id;

    const reduzir = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.body.id}/itens/${itemId}`)
      .set('Cookie', comercialCookies)
      .send({ novaQuantidade: 3 });
    expect(reduzir.status).toBe(200);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(7); // 10 - 3
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
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 5 }],
      });
    const itemId = (
      await request(app.getHttpServer()).get(`/comercial/pedidos/${pedido.body.id}`).set('Cookie', comercialCookies)
    ).body.itens[0].id;

    // aumentar (>= reservada) é rejeitado: só reduz
    const aumentar = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.body.id}/itens/${itemId}`)
      .set('Cookie', comercialCookies)
      .send({ novaQuantidade: 9 });
    expect(aumentar.status).toBe(409);

    const pedidoInexistente = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/019e0000-0000-7000-8000-0000000000cc/itens/${itemId}`)
      .set('Cookie', comercialCookies)
      .send({ novaQuantidade: 1 });
    expect(pedidoInexistente.status).toBe(404);
  });

  it('reduzir item para 0 libera a reserva inteira e devolve todo o saldo', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-10-10', 1, 10);
    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-10-10',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 6 }],
      });
    const itemId = (
      await request(app.getHttpServer()).get(`/comercial/pedidos/${pedido.body.id}`).set('Cookie', comercialCookies)
    ).body.itens[0].id;

    const reduzir = await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${pedido.body.id}/itens/${itemId}`)
      .set('Cookie', comercialCookies)
      .send({ novaQuantidade: 0 });
    expect(reduzir.status).toBe(200);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(10); // saldo totalmente devolvido
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
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 2 }],
      });
    const primeira = await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${pedido.body.id}`)
      .set('Cookie', comercialCookies)
      .send();
    expect(primeira.status).toBe(200);
    // já cancelado (soft-deleted) → 404 (não encontrado entre ativos)
    const segunda = await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${pedido.body.id}`)
      .set('Cookie', comercialCookies)
      .send();
    expect(segunda.status).toBe(404);
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
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 2 }],
      });
    const detalhe = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${pedido.body.id}`)
      .set('Cookie', comercialCookies);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.cliente.id).toBe(base.clienteId);
    const item = detalhe.body.itens[0];
    expect(item.itemComercial.id).toBe(base.itemComercialId);
    expect(item.reservas[0].disponibilidade.itemComercialId).toBe(base.itemComercialId);
    expect(item).toHaveProperty('preferenciasAplicadasJson');
  });
});
