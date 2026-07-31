import { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

describe('escopo-representantes e2e (E5.1 Task 20)', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let adminCookies: string;
  let comercialA: string;
  let comercialB: string;
  let repA: string;
  let repB: string;
  let clienteA: string;
  let clienteB: string;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;

    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);

    const userA = await createTestUser(app, { perfil: 'comercial' });
    const userB = await createTestUser(app, { perfil: 'comercial' });
    comercialA = await loginCookies(app, userA.adminEmail, userA.adminPassword);
    comercialB = await loginCookies(app, userB.adminEmail, userB.adminPassword);

    const [rA] = await db.insert(schema.representantes)
      .values({ codigo: uid('RA'), nome: 'Rep A' }).returning();
    const [rB] = await db.insert(schema.representantes)
      .values({ codigo: uid('RB'), nome: 'Rep B' }).returning();
    if (!rA || !rB) throw new Error('reps');
    repA = rA.id;
    repB = rB.id;

    const [cA] = await db.insert(schema.clientes).values({
      codigo: uid('CA'), razaoSocial: 'Cliente A', documentoFiscal: uid('DA'), representanteId: repA,
    }).returning();
    const [cB] = await db.insert(schema.clientes).values({
      codigo: uid('CB'), razaoSocial: 'Cliente B', documentoFiscal: uid('DB'), representanteId: repB,
    }).returning();
    if (!cA || !cB) throw new Error('clientes');
    clienteA = cA.id;
    clienteB = cB.id;

    const [uA] = await db.select().from(schema.usuarios).where(sql`${schema.usuarios.email} = ${userA.adminEmail}`);
    const [uB] = await db.select().from(schema.usuarios).where(sql`${schema.usuarios.email} = ${userB.adminEmail}`);
    if (!uA || !uB) throw new Error('users');

    await db.insert(schema.usuariosRepresentantes).values({ usuarioId: uA.id, representanteId: repA });
    await db.insert(schema.usuariosRepresentantes).values({ usuarioId: uB.id, representanteId: repB });
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('inativação não amplia autorização', async () => {
    await db.update(schema.representantes)
      .set({ status: 'inativo' })
      .where(sql`${schema.representantes.id} = ${repA}`);

    const res = await request(app.getHttpServer())
      .get('/clientes')
      .set('Cookie', comercialA)
      .expect(200);
    expect(res.body.data.some((c: { id: string }) => c.id === clienteA)).toBe(true);
  });

  it('dois usuários obtêm linhas e totais distintos de clientes', async () => {
    const resA = await request(app.getHttpServer()).get('/clientes').set('Cookie', comercialA).expect(200);
    const resB = await request(app.getHttpServer()).get('/clientes').set('Cookie', comercialB).expect(200);
    expect(resA.body.data.some((c: { id: string }) => c.id === clienteA)).toBe(true);
    expect(resA.body.data.some((c: { id: string }) => c.id === clienteB)).toBe(false);
    expect(resB.body.data.some((c: { id: string }) => c.id === clienteB)).toBe(true);
    expect(resA.body.total).not.toBe(resB.body.total);
  });

  it('oculta e protege todas as mutações de cliente fora do escopo', async () => {
    await request(app.getHttpServer())
      .get(`/clientes/${clienteB}`)
      .set('Cookie', comercialA)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/clientes/${clienteB}`)
      .set('Cookie', comercialA)
      .send({ razaoSocial: 'Hack' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/clientes/${clienteB}`)
      .set('Cookie', comercialA)
      .expect(404);
  });

  it('não cria nem transfere cliente para representante proibido', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', comercialA)
      .send({
        codigo: uid('NEW'),
        razaoSocial: 'Novo',
        documentoFiscal: uid('DN'),
        representanteId: repB,
      })
      .expect(404);
  });

  it('deriva representante somente de clientes.representante_id', async () => {
    const cols = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'pedidos_venda' AND column_name LIKE '%representante%'
    `);
    expect(cols.rows).toHaveLength(0);
  });
});
