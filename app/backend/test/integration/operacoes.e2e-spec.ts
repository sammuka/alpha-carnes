import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

describe('operacoes e2e', () => {
  let app: INestApplication;
  let gestorCookies: string;
  let comercialCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);

    const { db } = app.get<{ db: typeof schema extends never ? never : import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema> }>(DRIZZLE);
    await db.insert(schema.parametros).values({
      chave: 'operacao.cadencia_dias_semana',
      valorJson: { dias: [1, 3, 5], provisorio: true, ref: 'P1/v1.1 §16.2' },
    }).onConflictDoNothing({ target: schema.parametros.chave });
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('unique ativa; gerar duas vezes cria zero na segunda execução', async () => {
    const de = '2026-08-03'; // segunda
    const ate = '2026-08-07'; // sexta
    const primeira = await request(app.getHttpServer())
      .post('/operacoes/gerar-cadencia')
      .set('Cookie', gestorCookies)
      .send({ de, ate });
    expect(primeira.status).toBe(201);
    expect(primeira.body.criadas).toBeGreaterThan(0);

    const segunda = await request(app.getHttpServer())
      .post('/operacoes/gerar-cadencia')
      .set('Cookie', gestorCookies)
      .send({ de, ate });
    expect(segunda.status).toBe(201);
    expect(segunda.body.criadas).toBe(0);

    const { db } = app.get(DRIZZLE) as { db: import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema> };
    const contagem = await db.select({ total: sql<number>`count(*)::int` })
      .from(schema.operacoes)
      .where(and(isNull(schema.operacoes.deletedAt), eq(schema.operacoes.data, '2026-08-03')));
    expect(contagem[0]?.total).toBe(1);
  });

  it('comercial sem OPERACOES_GERENCIAR recebe 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', comercialCookies)
      .send({ data: '2026-08-10', rotulo: 'Extra' });
    expect(res.status).toBe(403);
  });
});
