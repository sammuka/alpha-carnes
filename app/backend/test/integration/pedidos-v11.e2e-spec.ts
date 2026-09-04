import { INestApplication } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
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
import {
  challengePayload,
  observarSql,
  snapshotOverbooking,
} from '../helpers/overbooking-fixtures';

describe('pedidos-v11 (AD-05 challenge + lifecycle)', () => {
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

  async function cenarioComSaldo(dataOperacao: string, quantidade: number) {
    const base = await seedComercialBase(app, { fator: 1 });
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao,
        fornecedorId: base.fornecedorId,
        itens: [{ produtoId: base.produtoCompraId, quantidadeComprada: quantidade }],
      });
    expect(criar.status).toBe(201);
    const compraId = criar.body.id as string;
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send()
      .expect(201);
    const disp = await lerDisponibilidade(app, base.produtoId);
    if (!disp) throw new Error('disponibilidade não gerada');
    return { base, compraId, disponibilidadeId: disp.id };
  }

  it('compras sem PEDIDO_OVERBOOKING_CONFIRMAR recebe 403', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-11-10', 2);
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comprasCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-10',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 5 }],
      });
    expect(res.status).toBe(403);
  });

  it('compras sem PEDIDO_FINALIZAR recebe 403', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-11-11', 2);
    const criado = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-11',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 4 }],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${criado.body.id}/finalizar`)
      .set('Cookie', comprasCookies)
      .send();
    expect(res.status).toBe(403);
  });

  it('409 challenge não executa escrita e não persiste mutação', async () => {
    const { base, compraId, disponibilidadeId } = await cenarioComSaldo('2026-11-01', 2);
    const drizzle = app.get(DRIZZLE);
    const antes = await snapshotOverbooking(drizzle, { disponibilidadeId });
    const escritas: string[] = [];
    const removerSpy = observarSql(drizzle, (sqlText) => {
      if (/^\s*(insert|update|delete)\b/i.test(sqlText)) escritas.push(sqlText);
    });

    const response = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-01',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 5 }],
      })
      .expect(409);

    const payload = challengePayload(response.body);
    expect(payload.code).toBe('OVERBOOKING_CONFIRMACAO_NECESSARIA');
    expect(payload.itens?.[0]).toMatchObject({
      disponivelAntes: '2.000',
      quantidadeSolicitada: '5.000',
      overbookingGerado: '3.000',
      mensagem: 'A venda poderá ser concluída, mas a gestão deverá tratar a falta.',
    });
    removerSpy();
    expect(escritas).toEqual([]);
    const depois = await snapshotOverbooking(drizzle, { disponibilidadeId });
    expect(depois).toEqual(antes);
  });

  it('confirmação de criação retorna 201 e persiste overbooking', async () => {
    const { base, compraId, disponibilidadeId } = await cenarioComSaldo('2026-11-02', 2);
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-02',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 5 }],
      })
      .expect(201);

    expect(res.body.status).toBe('em_elaboracao_reserva_ativa');
    const disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(0);
    expect(Number(disp!.quantidadeReservada)).toBe(2);

    const { db } = app.get(DRIZZLE);
    const itens = await db.select().from(schema.pedidosVendaItens)
      .where(and(
        eq(schema.pedidosVendaItens.pedidoVendaId, res.body.id),
        isNull(schema.pedidosVendaItens.deletedAt),
      ));
    expect(itens).toHaveLength(1);
    expect(itens[0]!.status).toBe('overbooking_confirmado');
    expect(itens[0]!.quantidadeOverbooking).toBe('3.000');

    const pendencias = await db.select().from(schema.pendenciasOverbooking)
      .where(eq(schema.pendenciasOverbooking.pedidoVendaId, res.body.id));
    expect(pendencias).toHaveLength(1);
    expect(pendencias[0]!.quantidadeDeficit).toBe('3.000');

    const reservas = await db.select().from(schema.reservasDisponibilidade)
      .where(eq(schema.reservasDisponibilidade.pedidoVendaItemId, itens[0]!.id));
    expect(reservas.some((r: { tipoConsumo: string }) => r.tipoConsumo === 'overbooking')).toBe(true);
    expect(reservas.some((r: { disponibilidadeVirtualId: string | null }) =>
      r.disponibilidadeVirtualId === disponibilidadeId)).toBe(true);
  });

  it('cobertura total cria pedido sem challenge', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-11-03', 10);
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-03',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 4 }],
      })
      .expect(201);
    expect(res.body.status).toBe('em_elaboracao_reserva_ativa');
    const disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(6);
  });

  it('item comercial duplicado no mesmo payload retorna 400 e zero mutação', async () => {
    const { base, compraId, disponibilidadeId } = await cenarioComSaldo('2026-11-04', 10);
    const drizzle = app.get(DRIZZLE);
    const antes = await snapshotOverbooking(drizzle, { disponibilidadeId });
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-04',
        itens: [
          { produtoId: base.produtoId, quantidadePedida: 1 },
          { produtoId: base.produtoId, quantidadePedida: 1 },
        ],
      });
    expect(res.status).toBe(400);
    const depois = await snapshotOverbooking(drizzle, { disponibilidadeId });
    expect(depois).toEqual(antes);
  });

  it('inclusão com challenge 409 e confirmação 200', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-11-05', 5);
    const criado = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-05',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 2 }],
      })
      .expect(201);

    // Segundo item comercial (mesmo saldo restante = 3)
    const base2 = await seedComercialBase(app, { fator: 1 });
    // Reusa a disponibilidade do mesmo dia: inclui o mesmo produtoId → conflito.
    // Em vez disso, tenta incluir quantidade acima do saldo restante no MESMO item → 409 no challenge.
    // Plano: inclusão de NOVO item comercial. Criamos outro item na mesma compra via nova regra? Simplifica:
    // incluir o mesmo item → 409 Conflict "já existe".
    const dup = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${criado.body.id}/itens`)
      .set('Cookie', comercialCookies)
      .send({ produtoId: base.produtoId, quantidade: 1 });
    expect(dup.status).toBe(409);
    const dupMsg = typeof dup.body.message === 'object' && dup.body.message !== null
      ? (dup.body.message as { message?: string }).message
      : dup.body.message;
    expect(String(dupMsg)).toContain('já existe');

    // Pedido só com saldo 0: cria pedido vazio de cobertura total e inclui com overbooking.
    const { base: b3, compraId: c3 } = await cenarioComSaldo('2026-11-06', 1);
    const p3 = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: c3,
        clienteId: b3.clienteId,
        dataOperacao: '2026-11-06',
        itens: [{ produtoId: b3.produtoId, quantidadePedida: 1 }],
      })
      .expect(201);

    // Novo item comercial sem disponibilidade na operação → challenge
    const challenge = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${p3.body.id}/itens`)
      .set('Cookie', comercialCookies)
      .send({ produtoId: base2.produtoId, quantidade: 3 })
      .expect(409);
    const payload = challengePayload(challenge.body);
    expect(payload.code).toBe('OVERBOOKING_CONFIRMACAO_NECESSARIA');

    const ok = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${p3.body.id}/itens/confirmar-overbooking`)
      .set('Cookie', comercialCookies)
      .send({ produtoId: base2.produtoId, quantidade: 3 })
      .expect(200);
    expect(ok.body.id).toBe(p3.body.id);
  });

  it('finalizar overbooking_confirmado retorna 200', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-11-07', 1);
    const criado = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-07',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 4 }],
      })
      .expect(201);

    const fin = await request(app.getHttpServer())
      .post(`/comercial/pedidos/${criado.body.id}/finalizar`)
      .set('Cookie', comercialCookies)
      .send()
      .expect(200);
    expect(fin.body.status).toBe('finalizado');
  });

  it('redução somente déficit; redução além do déficit; remoção; cancelamento', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-11-08', 2);
    const criado = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-08',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 5 }],
      })
      .expect(201);

    const { db } = app.get(DRIZZLE);
    const [item] = await db.select().from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.pedidoVendaId, criado.body.id));
    if (!item) throw new Error('item ausente');

    // Reduz só déficit: 5 → 3 (tira 2 de overbooking; real permanece 2)
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${criado.body.id}/itens/${item.id}`)
      .set('Cookie', comercialCookies)
      .send({ novaQuantidade: 3, motivo: 'ajuste déficit' })
      .expect(200);
    let disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(0);
    expect(Number(disp!.quantidadeReservada)).toBe(2);

    // Reduz além do déficit: 3 → 1 (tira 1 real)
    await request(app.getHttpServer())
      .patch(`/comercial/pedidos/${criado.body.id}/itens/${item.id}`)
      .set('Cookie', comercialCookies)
      .send({ novaQuantidade: 1, motivo: 'devolver real' })
      .expect(200);
    disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(1);
    expect(Number(disp!.quantidadeReservada)).toBe(1);

    // Remoção
    await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${criado.body.id}/itens/${item.id}`)
      .set('Cookie', comercialCookies)
      .send({ motivo: 'remover item' })
      .expect(200);
    disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(2);

    // Novo pedido para cancelar
    const p2 = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-08',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 3 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/comercial/pedidos/${p2.body.id}`)
      .set('Cookie', comercialCookies)
      .send({ motivo: 'cliente desistiu' })
      .expect(200);
    disp = await lerDisponibilidade(app, base.produtoId);
    expect(Number(disp!.quantidadeDisponivel)).toBe(2);
  });

  it('fila overbooking: transição válida e inválida', async () => {
    const { base, compraId } = await cenarioComSaldo('2026-11-09', 1);
    const criado = await request(app.getHttpServer())
      .post('/comercial/pedidos/confirmar-overbooking')
      .set('Cookie', comercialCookies)
      .send({
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        dataOperacao: '2026-11-09',
        itens: [{ produtoId: base.produtoId, quantidadePedida: 4 }],
      })
      .expect(201);

    const { db } = app.get(DRIZZLE);
    const [pend] = await db.select().from(schema.pendenciasOverbooking)
      .where(eq(schema.pendenciasOverbooking.pedidoVendaId, criado.body.id));
    if (!pend) throw new Error('pendência ausente');

    const lista = await request(app.getHttpServer())
      .get('/comercial/overbooking')
      .query({ operacaoId: pend.operacaoId })
      .set('Cookie', comercialCookies)
      .expect(200);
    expect(lista.body.data.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post(`/comercial/overbooking/${pend.id}/decisao`)
      .set('Cookie', gestorCookies)
      .send({
        caminho: 'compra_complementar',
        compraProgramadaId: compraId,
        quantidade: String(pend.quantidadeDeficit),
        observacao: 'ok',
      })
      .expect(201);

    const invalida = await request(app.getHttpServer())
      .patch(`/comercial/overbooking/${pend.id}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'aberta', detalhe: {} });
    expect(invalida.status).toBe(409);

    await request(app.getHttpServer())
      .patch(`/comercial/overbooking/${pend.id}/status`)
      .set('Cookie', gestorCookies)
      .send({ status: 'resolvida', detalhe: {} })
      .expect(200);
  });
});
