import { INestApplication } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase, criarCompraConfirmada } from '../helpers/comercial-fixtures';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { RecebimentoService } from '../../src/modules/operacao/recebimento/recebimento.service';
import request from 'supertest';

// Conclusão idempotente sob concorrência (S5-like): N conclusões em paralelo
// devem produzir exatamente UMA conclusão efetiva (jaConcluido=false) — o UPDATE
// condicional por status garante que o efeito não duplica.
describe('Recebimento — conclusão idempotente sob concorrência', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let recebimentoCookies: string;
  let usuarioId: string;
  let service: RecebimentoService;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
    service = app.get(RecebimentoService);

    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const u = await db.select().from(schema.usuarios).limit(1);
    usuarioId = u[0]!.id;
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('N conclusões em paralelo → exatamente 1 efetiva', async () => {
    const base = await seedComercialBase(app, { fator: 1 });
    const compraId = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: '2026-11-20', quantidade: 10 });
    const ini = await request(app.getHttpServer())
      .post('/operacao/recebimentos')
      .set('Cookie', recebimentoCookies)
      .send({ compraProgramadaId: compraId, nfeNumero: '128934' });
    const recId = ini.body.recebimento.id as string;
    await request(app.getHttpServer())
      .post(`/operacao/recebimentos/${recId}/itens`)
      .set('Cookie', recebimentoCookies)
      .send({ itemComercialId: base.itemComercialId, quantidadeRecebida: 10 });

    const resultados = await Promise.all(
      Array.from({ length: 8 }, () => service.concluir(recId, usuarioId)),
    );

    const efetivas = resultados.filter((r) => r.jaConcluido === false);
    expect(efetivas).toHaveLength(1);
    expect(resultados.every((r) => r.recebimento.status === 'finalizado')).toBe(true);
  }, 60000);
});
