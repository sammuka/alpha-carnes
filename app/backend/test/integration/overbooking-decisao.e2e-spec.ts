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
import { lerDisponibilidade, seedComercialBase } from '../helpers/comercial-fixtures';
import { criarOutroCliente } from '../helpers/pesagem-fixtures';

async function lerPendencia(app: INestApplication, id: string) {
  const res = await request(app.getHttpServer())
    .get(`/comercial/overbooking/${id}`)
    .set('Cookie', (global as { gestorCookies?: string }).gestorCookies ?? '');
  if (res.status !== 200) throw new Error(`lerPendencia falhou: ${res.status}`);
  return res.body;
}

async function lerPedido(app: INestApplication, id: string, cookies: string) {
  const res = await request(app.getHttpServer())
    .get(`/comercial/pedidos/${id}`)
    .set('Cookie', cookies);
  if (res.status !== 200) throw new Error(`lerPedido falhou: ${res.status}`);
  return res.body;
}

describe('overbooking-decisao (DoD 2 — cobertura e 3 caminhos)', () => {
  let app: INestApplication;
  let comercialCookies: string;
  let comprasCookies: string;
  let gestorCookies: string;
  let tzId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    (global as { gestorCookies?: string }).gestorCookies = gestorCookies;
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function cenarioComSaldo(dataOperacao: string, quantidade: number) {
    const base = await seedComercialBase(app, { fator: 1 });
    tzId = base.itemComercialId;
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao,
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: quantidade }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${criar.body.id}/confirmar`)
      .set('Cookie', comprasCookies)
      .expect(201);
    return { base, compraId: criar.body.id as string };
  }

  async function criarPedidoOverbooking(
    compraId: string,
    base: { clienteId: string; itemComercialId: string },
    dataOperacao: string,
    quantidade: number,
    clienteId?: string,
  ) {
    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: clienteId ?? base.clienteId,
        dataOperacao,
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: quantidade }],
      })
      .expect(201);
    const { db } = app.get(DRIZZLE);
    const [pend] = await db.select().from(schema.pendenciasOverbooking)
      .where(eq(schema.pendenciasOverbooking.pedidoVendaId, pedido.body.id));
    if (!pend) throw new Error('pendência ausente');
    return { pedidoId: pedido.body.id as string, pendenciaId: pend.id, pendencia: pend };
  }

  it('2.1 GET cobertura lista compras futuras, redistribuições e próxima operação', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-01', 10);
    const { pendenciaId } = await criarPedidoOverbooking(compraId, base, '2026-12-01', 15);

    const compraFutura = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-12-02',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 5 }],
      })
      .expect(201);

    const cobertura = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pendenciaId}/cobertura`)
      .set('Cookie', gestorCookies)
      .expect(200);

    expect(cobertura.body.pendenciaId).toBe(pendenciaId);
    expect(cobertura.body.comprasComplementares.length).toBeGreaterThanOrEqual(2);
    expect(cobertura.body.comprasComplementares.some(
      (c: { compraProgramadaId: string }) => c.compraProgramadaId === compraFutura.body.id,
    )).toBe(true);
    expect(cobertura.body.proximaOperacao).toMatchObject({ data: '2026-12-02' });
  });

  it('2.2 GET historico retorna linha do tempo em ordem cronológica', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-03', 5);
    const { pendenciaId } = await criarPedidoOverbooking(compraId, base, '2026-12-03', 8);

    await request(app.getHttpServer())
      .patch(`/comercial/overbooking/${pendenciaId}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'em_analise', detalhe: { nota: 'analisando' } })
      .expect(200);

    const historico = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pendenciaId}/historico`)
      .set('Cookie', gestorCookies)
      .expect(200);

    expect(historico.body.length).toBeGreaterThanOrEqual(2);
    const datas = historico.body.map((h: { criadoEm: string }) => h.criadoEm);
    expect(datas).toEqual([...datas].sort());
  });

  it('2.3 compra complementar muda status sem abater déficit', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-04', 5);
    const { pendenciaId, pendencia } = await criarPedidoOverbooking(compraId, base, '2026-12-04', 8);

    const futura = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-12-05',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 10 }],
      })
      .expect(201);

    const { body } = await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'compra_complementar',
        compraProgramadaId: futura.body.id,
        quantidade: '3.000',
      })
      .expect(201);

    expect(body.status).toBe('compra_complementar_programada');
    expect(body.quantidadeDeficit).toBe(pendencia.quantidadeDeficit);
    expect(body.decisaoJson.compraProgramadaId).toBe(futura.body.id);
  });

  it('2.4 compra complementar rejeita compra passada', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-06', 5);
    const { pendenciaId } = await criarPedidoOverbooking(compraId, base, '2026-12-06', 8);
    const antes = await lerPendencia(app, pendenciaId);

    const passada = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-11-28',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 10 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'compra_complementar',
        compraProgramadaId: passada.body.id,
        quantidade: '2.000',
      })
      .expect(409);

    const pos = await lerPendencia(app, pendenciaId);
    expect(pos.status).toBe(antes.status);
    expect(pos.quantidadeDeficit).toBe(antes.quantidadeDeficit);
  });

  it('2.5 redistribuição preserva o agregado de disponibilidade', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-07', 10);
    tzId = base.itemComercialId;

    await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-12-07',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 8 }],
      })
      .expect(201);

    const clienteOverbooking = await criarOutroCliente(app);
    const { pendenciaId } = await criarPedidoOverbooking(
      compraId, base, '2026-12-07', 8, clienteOverbooking,
    );

    const cobertura = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pendenciaId}/cobertura`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const reservaOrigemId = cobertura.body.redistribuicoes[0]?.reservaId;
    expect(reservaOrigemId).toBeDefined();

    const antes = await lerDisponibilidade(app, tzId);
    await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({ caminho: 'redistribuicao', reservaOrigemId, quantidade: '4.000' })
      .expect(201);

    const depois = await lerDisponibilidade(app, tzId);
    expect(depois!.quantidadeReservada).toBe(antes!.quantidadeReservada);
    expect(depois!.quantidadeDisponivel).toBe(antes!.quantidadeDisponivel);

    const pendencia = await lerPendencia(app, pendenciaId);
    expect(pendencia.quantidadeDeficit).toBe('2.000');
    expect(pendencia.status).toBe('redistribuicao_decidida');
  });

  it('2.6 redistribuição rejeita quantidade acima do saldo da reserva', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-08', 10);
    await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-12-08',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 8 }],
      })
      .expect(201);
    const clienteOverbooking = await criarOutroCliente(app);
    const { pendenciaId } = await criarPedidoOverbooking(
      compraId, base, '2026-12-08', 8, clienteOverbooking,
    );
    const cobertura = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pendenciaId}/cobertura`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const antes = await lerPendencia(app, pendenciaId);

    await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'redistribuicao',
        reservaOrigemId: cobertura.body.redistribuicoes[0].reservaId,
        quantidade: '99.000',
      })
      .expect(409);

    const pos = await lerPendencia(app, pendenciaId);
    expect(pos.status).toBe(antes.status);
    expect(pos.quantidadeDeficit).toBe(antes.quantidadeDeficit);
  });

  it('2.7 postergação parcial gera novo pedido e abate o déficit uma única vez', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-09', 10);
    await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-12-09',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 6 }],
      })
      .expect(201);
    const clienteOverbooking = await criarOutroCliente(app);
    const { pendenciaId, pedidoId: pedidoOrigemId } = await criarPedidoOverbooking(
      compraId, base, '2026-12-09', 10, clienteOverbooking,
    );

    const compraDestino = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-12-10',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 20 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraDestino.body.id}/confirmar`)
      .set('Cookie', comprasCookies)
      .expect(201);

    const cobertura = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pendenciaId}/cobertura`)
      .set('Cookie', gestorCookies)
      .expect(200);
    const proximaOperacaoId = cobertura.body.proximaOperacao.id;
    const compraDestinoId = compraDestino.body.id;

    const { body } = await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'novo_pedido',
        quantidade: '4.000',
        operacaoDestinoId: proximaOperacaoId,
        compraProgramadaId: compraDestinoId,
      })
      .expect(201);

    expect(body.status).toBe('novo_pedido_criado');
    expect(body.quantidadeDeficit).toBe('2.000');
    expect(body.decisaoJson.novoPedidoId).toEqual(expect.any(String));
    const novo = await lerPedido(app, body.decisaoJson.novoPedidoId, gestorCookies);
    expect(novo.operacaoId).toBe(proximaOperacaoId);
    expect(Number(novo.itens[0].quantidadePedida)).toBe(4);
    const origem = await lerPedido(app, pedidoOrigemId, gestorCookies);
    expect(Number(origem.itens[0].quantidadePedida)).toBe(6);
  });

  it('2.8 postergação total remove o item de origem e encerra a pendência', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-11', 6);
    await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-12-11',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 6 }],
      })
      .expect(201);
    const clienteOverbooking = await criarOutroCliente(app);
    const { pendenciaId, pedidoId: pedidoOrigemId } = await criarPedidoOverbooking(
      compraId, base, '2026-12-11', 6, clienteOverbooking,
    );

    const compraDestino = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-12-12',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 10 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraDestino.body.id}/confirmar`)
      .set('Cookie', comprasCookies)
      .expect(201);

    const cobertura = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pendenciaId}/cobertura`)
      .set('Cookie', gestorCookies)
      .expect(200);

    const { body } = await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'novo_pedido',
        quantidade: '6.000',
        operacaoDestinoId: cobertura.body.proximaOperacao.id,
        compraProgramadaId: compraDestino.body.id,
      })
      .expect(201);

    expect(body.status).toBe('cancelada');
    expect(body.decisaoJson.itemOrigemRemovido).toBe(true);
    const origem = await lerPedido(app, pedidoOrigemId, gestorCookies);
    expect(origem.itens[0].deletedAt).not.toBeNull();
    const novo = await lerPedido(app, body.decisaoJson.novoPedidoId, gestorCookies);
    expect(Number(novo.itens[0].quantidadePedida)).toBe(6);
  });

  it('2.9 decisão rejeita quantidade acima do déficit', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-13', 5);
    const { pendenciaId } = await criarPedidoOverbooking(compraId, base, '2026-12-13', 8);
    const antes = await lerPendencia(app, pendenciaId);

    await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'compra_complementar',
        compraProgramadaId: compraId,
        quantidade: '99.000',
      })
      .expect(409);

    const pos = await lerPendencia(app, pendenciaId);
    expect(pos.status).toBe(antes.status);
    expect(pos.quantidadeDeficit).toBe(antes.quantidadeDeficit);
  });

  it('2.10 novo pedido rejeita operação destino anterior ou igual', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-14', 5);
    const { pendenciaId } = await criarPedidoOverbooking(compraId, base, '2026-12-14', 8);
    const { db } = app.get(DRIZZLE);
    const [op] = await db.select().from(schema.operacoes)
      .where(eq(schema.operacoes.data, '2026-12-14'));
    const antes = await lerPendencia(app, pendenciaId);

    await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'novo_pedido',
        quantidade: '2.000',
        operacaoDestinoId: op!.id,
        compraProgramadaId: compraId,
      })
      .expect(409);

    const pos = await lerPendencia(app, pendenciaId);
    expect(pos.status).toBe(antes.status);
    expect(pos.quantidadeDeficit).toBe(antes.quantidadeDeficit);
  });

  it('2.11 transição inválida retorna 409', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-15', 5);
    const { pendenciaId } = await criarPedidoOverbooking(compraId, base, '2026-12-15', 8);

    await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'compra_complementar',
        compraProgramadaId: compraId,
        quantidade: '1.000',
      })
      .expect(201);

    const antes = await lerPendencia(app, pendenciaId);

    await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'compra_complementar',
        compraProgramadaId: compraId,
        quantidade: '1.000',
      })
      .expect(409);

    const pos = await lerPendencia(app, pendenciaId);
    expect(pos.status).toBe(antes.status);
    expect(pos.quantidadeDeficit).toBe(antes.quantidadeDeficit);
  });

  it('2.12 cobertura 404 para pendência inexistente', async () => {
    await request(app.getHttpServer())
      .get('/comercial/overbooking/019ea000-0000-7000-8000-000000000099/cobertura')
      .set('Cookie', gestorCookies)
      .expect(404);
  });

  it('2.13 comercial sem OVERBOOKING_RESOLVER recebe 403 na decisão', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-16', 5);
    const { pendenciaId } = await criarPedidoOverbooking(compraId, base, '2026-12-16', 8);
    const antes = await lerPendencia(app, pendenciaId);

    await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', comercialCookies)
      .send({
        caminho: 'compra_complementar',
        compraProgramadaId: compraId,
        quantidade: '1.000',
      })
      .expect(403);

    const pos = await lerPendencia(app, pendenciaId);
    expect(pos.status).toBe(antes.status);
    expect(pos.quantidadeDeficit).toBe(antes.quantidadeDeficit);
  });

  it('2.14 redistribuição zera déficit e resolve pendência', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-17', 10);
    await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-12-17',
        itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 8 }],
      })
      .expect(201);
    const clienteOverbooking = await criarOutroCliente(app);
    const { pendenciaId } = await criarPedidoOverbooking(
      compraId, base, '2026-12-17', 4, clienteOverbooking,
    );
    const cobertura = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pendenciaId}/cobertura`)
      .set('Cookie', gestorCookies)
      .expect(200);

    const { body } = await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pendenciaId}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'redistribuicao',
        reservaOrigemId: cobertura.body.redistribuicoes[0].reservaId,
        quantidade: '2.000',
      })
      .expect(201);

    expect(body.status).toBe('resolvida');
  });

  it('7.5.6 marcar como resolvido manualmente grava histórico', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-18', 5);
    const { pendenciaId } = await criarPedidoOverbooking(compraId, base, '2026-12-18', 8);
    await request(app.getHttpServer())
      .patch(`/comercial/overbooking/${pendenciaId}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'resolvida', detalhe: { origem: 'manual' } })
      .expect(200);
    const pendencia = await lerPendencia(app, pendenciaId);
    expect(pendencia.status).toBe('resolvida');
    const hist = await request(app.getHttpServer())
      .get(`/comercial/overbooking/${pendenciaId}/historico`)
      .set('Cookie', gestorCookies)
      .expect(200);
    expect(hist.body.some((h: { acao: string }) => h.acao === 'resolvida')).toBe(true);
  });

  it('7.5.7 cancelamento exige motivo', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-12-19', 5);
    const { pendenciaId } = await criarPedidoOverbooking(compraId, base, '2026-12-19', 8);
    await request(app.getHttpServer())
      .patch(`/comercial/overbooking/${pendenciaId}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'cancelada', detalhe: {} })
      .expect(400);
    const inalterada = await lerPendencia(app, pendenciaId);
    expect(inalterada.status).toBe('aberta');
    await request(app.getHttpServer())
      .patch(`/comercial/overbooking/${pendenciaId}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'cancelada', detalhe: { motivo: 'Cliente desistiu do pedido' } })
      .expect(200);
  });
});
