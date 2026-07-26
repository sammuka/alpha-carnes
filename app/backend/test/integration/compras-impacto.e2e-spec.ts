import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, lerDisponibilidade } from '../helpers/comercial-fixtures';
import { EVENTOS } from '../../src/realtime/events/eventos';

describe('Compras — painel de impacto e edição confirmada', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let adminCookies: string;
  let base: Awaited<ReturnType<typeof seedComercialBase>>;
  let compraId: string;
  let itemId: string;
  let tzId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    const admin = await createTestUser(app, { perfil: 'administrador' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    base = await seedComercialBase(app, { fator: 2 });
    tzId = base.itemComercialId;

    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-09-01',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 100 }],
      });
    compraId = criar.body.id;
    itemId = criar.body.itens[0].id;

    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .expect(201);

    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        dataOperacao: '2026-09-01',
        compraProgramadaId: compraId,
        clienteId: base.clienteId,
        itens: [{ itemComercialId: tzId, quantidadePedida: 150 }],
        confirmado: true,
      })
      .expect(201);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('impacto sem simulação zera os deltas', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/comercial/compras-programadas/${compraId}/impacto`)
      .set('Cookie', comprasCookies)
      .expect(200);
    expect(body.itens.length).toBeGreaterThan(0);
    for (const item of body.itens) {
      expect(item.delta).toBe('0.000');
    }
  });

  it('projeta desdobramento do boi casado 2 TZ + 2 DT + 2 PA (AD-01)', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/comercial/compras-programadas/${compraId}/impacto`)
      .query({ simulacao: `${base.itemCompraId}:80` })
      .set('Cookie', comprasCookies)
      .expect(200);
    const tz = body.itens.find((i: { itemComercialId: string }) => i.itemComercialId === tzId);
    expect(tz.quantidadeGeradaProjetada).toBe('160.000');
  });

  it('409 não persiste nada', async () => {
    const antes = await lerDisponibilidade(app, tzId);
    const { body } = await request(app.getHttpServer())
      .patch(`/comercial/compras-programadas/${compraId}/itens/${itemId}`)
      .set('Cookie', comprasCookies)
      .send({ quantidadeComprada: '60.000' })
      .expect(409);

    const payload = typeof body.message === 'object' ? body.message : body;
    expect(payload.codigo).toBe('IMPACTO_CONFIRMACAO_NECESSARIA');
    expect(payload.impacto.deficitTotal).toBe('30.000');
    const depois = await lerDisponibilidade(app, tzId);
    expect(depois).toEqual(antes);
  });

  it('recálculo atômico da disponibilidade', async () => {
    const { body } = await request(app.getHttpServer())
      .patch(`/comercial/compras-programadas/${compraId}/itens/${itemId}`)
      .set('Cookie', comprasCookies)
      .send({ quantidadeComprada: '60.000', confirmarDeficit: true })
      .expect(200);

    expect(body.item.quantidadeComprada).toBe('60.000');
    const dv = await lerDisponibilidade(app, tzId);
    expect(dv?.quantidadeTotalGerada).toBe('120.000');
    expect(dv?.quantidadeReservada).toBe('150.000');
    expect(dv?.quantidadeDisponivel).toBe('0.000');
    expect(dv?.status).toBe('esgotada');
  });

  it('saldo clampado e status derivado', async () => {
    const dv = await lerDisponibilidade(app, tzId);
    expect(Number(dv?.quantidadeDisponivel)).toBeGreaterThanOrEqual(0);
    expect(['esgotada', 'parcialmente_reservada', 'gerada']).toContain(dv?.status);
  });

  it('compra cancelada não aceita edição', async () => {
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-09-15',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 10 }],
      });
    const cid = criar.body.id;
    const iid = criar.body.itens[0].id;
    await request(app.getHttpServer())
      .delete(`/comercial/compras-programadas/${cid}`)
      .set('Cookie', comprasCookies)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/comercial/compras-programadas/${cid}/itens/${iid}`)
      .set('Cookie', comprasCookies)
      .send({ quantidadeComprada: '5.000' })
      .expect(409);
  });

  it('auditoria completa da alteração', async () => {
    const log = await request(app.getHttpServer())
      .get('/auditoria?tabela=compras_programadas_itens&operacao=UPDATE')
      .set('Cookie', adminCookies);
    expect(log.body.total).toBeGreaterThanOrEqual(1);
    const dvLog = await request(app.getHttpServer())
      .get('/auditoria?tabela=disponibilidades_virtuais&operacao=UPDATE')
      .set('Cookie', adminCookies);
    expect(dvLog.body.total).toBeGreaterThanOrEqual(1);
  });

  it('evento pós-commit', async () => {
    const emitter = app.get(EventEmitter2);
    const spy = jest.spyOn(emitter, 'emit');
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-09-20',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 50 }],
      });
    const cid = criar.body.id;
    const iid = criar.body.itens[0].id;
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${cid}/confirmar`)
      .set('Cookie', comprasCookies);
    spy.mockClear();
    await request(app.getHttpServer())
      .patch(`/comercial/compras-programadas/${cid}/itens/${iid}`)
      .set('Cookie', comprasCookies)
      .send({ quantidadeComprada: '55.000' })
      .expect(200);
    expect(spy).toHaveBeenCalledWith(
      EVENTOS.COMPRA_ALTERADA_IMPACTO,
      expect.objectContaining({ compraId: cid, dataOperacao: '2026-09-20' }),
    );
  });

  it('histórico derivado da auditoria', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/comercial/compras-programadas/${compraId}/historico`)
      .set('Cookie', comprasCookies)
      .expect(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('dataHora');
    expect(body[0]).toHaveProperty('operacao');
  });
});
