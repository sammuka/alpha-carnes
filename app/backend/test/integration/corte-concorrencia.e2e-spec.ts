import type { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes } from '../helpers/pesagem-fixtures';
import { iniciarCorte, adicionarSubitem, pesarSubitem } from '../helpers/corte-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Corte — concorrência de associação de subitens (F4c)', () => {
  let app: INestApplication;
  let recebimentoCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let corteCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const corte = await createTestUser(app, { perfil: 'corte' });
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    corteCookies = await loginCookies(app, corte.adminEmail, corte.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();
  const db = () => app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

  it('N subitens no mesmo item com saldo limitado: atendida nunca excede pedida', async () => {
    const { default: request } = await import('supertest');
    const base = await seedComercialBase(app, { fator: 1 });
    const c = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: '2026-11-10', quantidade: 10 },
    );
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('1.000');

    const saldo = 3;
    const total = 6;
    const { pedidoItemId } = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: saldo,
    });

    const pecaId = await pesarPeca(app, recebimentoCookies, { recebimentoId: c.recebimentoId, itemComercialBaseId: c.itemComercialId });
    const transfId = await iniciarCorte(app, corteCookies, pecaId);

    const subIds: string[] = [];
    for (let i = 0; i < total; i++) {
      const subId = await adicionarSubitem(app, corteCookies, transfId, c.itemComercialId);
      await pesarSubitem(app, corteCookies, subId);
      subIds.push(subId);
    }

    // Associar todos em paralelo — concorrência real
    const resultados = await Promise.all(
      subIds.map((id) =>
        request(srv())
          .post(`/operacao/corte/subitens/${id}/associar`)
          .set('Cookie', corteCookies)
          .send({ pedidoVendaItemId: pedidoItemId }),
      ),
    );

    const sucessos = resultados.filter((r) => r.status === 201).length;
    const conflitos = resultados.filter((r) => r.status === 409).length;
    expect(sucessos).toBe(saldo);
    expect(conflitos).toBe(total - saldo);

    const item = await db()
      .select()
      .from(schema.pedidosVendaItens)
      .where(eq(schema.pedidosVendaItens.id, pedidoItemId))
      .then((r) => r[0]!);
    expect(item.quantidadeAtendida).toBe('3.000'); // nunca excede pedida
  }, 60000);
});
