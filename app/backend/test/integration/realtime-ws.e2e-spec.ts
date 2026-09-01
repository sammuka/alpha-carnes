import { INestApplication } from '@nestjs/common';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { EVENTOS } from '../../src/realtime/events/eventos';

// Handshake/auth/broadcast via WebSocket real. createTestApp já faz listen(0).
describe('Realtime WebSocket e2e (handshake, auth, broadcast pós-commit)', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let port: number;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    port = (app.getHttpServer().address() as AddressInfo).port;
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  function abrir(cookie?: string): WebSocket {
    return new WebSocket(`ws://127.0.0.1:${port}`, cookie ? { headers: { Cookie: cookie } } : undefined);
  }

  it('rejeita handshake sem cookie de autenticação', async () => {
    const ws = abrir();
    const erro = await new Promise<boolean>((resolve) => {
      ws.on('open', () => {
        ws.close();
        resolve(false);
      });
      ws.on('error', () => resolve(true));
      ws.on('unexpected-response', () => resolve(true));
    });
    expect(erro).toBe(true);
  });

  it('aceita handshake autenticado e recebe broadcast após confirmar compra', async () => {
    const base = await seedComercialBase(app, { fator: 2 });
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: '2026-12-10',
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 5 }],
      });
    const compraId = criar.body.id as string;

    const ws = abrir(comprasCookies);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', (e) => reject(e));
    });

    // assina a room da operação do dia
    ws.send(JSON.stringify({ type: 'subscribe', room: 'operacao:2026-12-10' }));
    // pequena espera para o subscribe ser processado antes do evento
    await new Promise((r) => setTimeout(r, 100));

    const mensagem = new Promise<{ type: string; payload: { compraId: string } }>((resolve) => {
      ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === EVENTOS.DISPONIBILIDADE_GERADA) resolve(msg);
      });
    });

    await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();

    const msg = await mensagem;
    expect(msg.type).toBe(EVENTOS.DISPONIBILIDADE_GERADA);
    expect(msg.payload.compraId).toBe(compraId);

    ws.close();
    await new Promise((r) => setTimeout(r, 50));
  }, 60000);
});
