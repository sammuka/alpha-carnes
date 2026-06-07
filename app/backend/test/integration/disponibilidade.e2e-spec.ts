import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, lerDisponibilidade } from '../helpers/comercial-fixtures';
import { EVENTOS } from '../../src/realtime/events/eventos';

describe('Disponibilidade virtual e2e (geração transacional + idempotência + evento)', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let base: Awaited<ReturnType<typeof seedComercialBase>>;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function criarEConfirmar(dataOperacao: string, fator: number, quantidade: number) {
    base = await seedComercialBase(app, { fator });
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao,
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: quantidade }],
      });
    expect(criar.status).toBe(201);
    return criar.body.id as string;
  }

  it('confirmar gera disponibilidade = fator × quantidade comprada', async () => {
    const compraId = await criarEConfirmar('2026-09-01', 4, 10);

    const confirmar = await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    expect(confirmar.status).toBe(201);

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(disp).not.toBeNull();
    expect(Number(disp!.quantidadeTotalGerada)).toBe(40); // 4 × 10
    expect(Number(disp!.quantidadeDisponivel)).toBe(40);
    expect(Number(disp!.quantidadeReservada)).toBe(0);
    expect(disp!.status).toBe('gerada');
  });

  it('IDEMPOTÊNCIA: confirmar duas vezes não duplica saldo', async () => {
    const compraId = await criarEConfirmar('2026-09-02', 3, 5);

    const primeira = await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    expect(primeira.status).toBe(201);
    expect(primeira.body.jaConfirmada).toBe(false);

    const segunda = await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    expect(segunda.status).toBe(201);
    expect(segunda.body.jaConfirmada).toBe(true); // no-op idempotente

    const disp = await lerDisponibilidade(app, base.itemComercialId);
    expect(Number(disp!.quantidadeTotalGerada)).toBe(15); // 3 × 5, não duplicado
  });

  it('emite evento disponibilidade_virtual_gerada APÓS confirmar', async () => {
    const compraId = await criarEConfirmar('2026-09-03', 2, 7);
    const emitter = app.get(EventEmitter2);

    const recebido = new Promise<{ compraId: string; itens: unknown[] }>((resolve) => {
      emitter.once(EVENTOS.DISPONIBILIDADE_GERADA, (payload) => resolve(payload));
    });

    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();

    const payload = await recebido;
    expect(payload.compraId).toBe(compraId);
    expect(payload.itens.length).toBeGreaterThan(0);
  });

  it('leitura de disponibilidade por dataOperacao', async () => {
    const compraId = await criarEConfirmar('2026-09-04', 1, 9);
    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();

    const res = await request(app.getHttpServer())
      .get('/comercial/disponibilidade?dataOperacao=2026-09-04')
      .set('Cookie', comprasCookies);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(Number(res.body[0].quantidadeTotalGerada)).toBe(9);
  });
});
