import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, joinSetCookie } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';
import { auditoria } from '../../src/database/schema/auditoria.schema';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/schema';

describe('Auditoria e2e', () => {
  let app: INestApplication;
  let adminCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const fixture = await createTestUser(app, { perfil: 'administrador' });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.adminEmail, password: fixture.adminPassword });
    adminCookies = joinSetCookie(loginRes);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  describe('Login registra auditoria', () => {
    it('login bem-sucedido cria registro de auditoria com modulo=auth', async () => {
      const fixture = await createTestUser(app, { perfil: 'comercial' });

      const before = new Date();
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: fixture.adminEmail, password: fixture.adminPassword })
        .expect(200);

      const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
      const registros = await db
        .select()
        .from(auditoria)
        .where(sql`${auditoria.modulo} = 'auth' AND ${auditoria.createdAt} >= ${before}`);

      expect(registros.length).toBeGreaterThanOrEqual(1);
      expect(registros[0]?.operacao).toBe('ACAO_MANUAL');
    });
  });

  describe('Ação administrativa registra auditoria', () => {
    it('POST /usuarios (sucesso) cria registro de auditoria com modulo=usuarios', async () => {
      const before = new Date();
      await request(app.getHttpServer())
        .post('/usuarios')
        .set('Cookie', adminCookies)
        .send({ nome: 'Auditado', email: `auditado-${Date.now()}@test.local`, password: 'Senha@12345678' })
        .expect(201);

      const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
      const registros = await db
        .select()
        .from(auditoria)
        .where(sql`${auditoria.modulo} = 'usuarios' AND ${auditoria.createdAt} >= ${before}`);

      expect(registros.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Atomicidade: ação que falha não gera auditoria de sucesso', () => {
    it('POST /usuarios com email duplicado (409) não deve criar registro de auditoria de sucesso', async () => {
      // Criar usuário
      const email = `dup-${Date.now()}@test.local`;
      await request(app.getHttpServer())
        .post('/usuarios')
        .set('Cookie', adminCookies)
        .send({ nome: 'Original', email, password: 'Senha@12345678' })
        .expect(201);

      const before = new Date();
      // Tentar criar de novo com mesmo email
      const failRes = await request(app.getHttpServer())
        .post('/usuarios')
        .set('Cookie', adminCookies)
        .send({ nome: 'Duplicado', email, password: 'Senha@12345678' });
      expect(failRes.status).toBe(409);

      // NÃO deve haver registro de auditoria APÓS o 409
      const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
      const registros = await db
        .select()
        .from(auditoria)
        .where(sql`${auditoria.modulo} = 'usuarios' AND ${auditoria.createdAt} >= ${before}`);

      // Pode haver 0 registros (nenhum de sucesso para ação que falhou)
      const sucessos = registros.filter((r) => r.operacao === 'ACAO_MANUAL');
      expect(sucessos.length).toBe(0);
    });
  });

  describe('Consulta paginada', () => {
    it('GET /auditoria lista registros com filtros', async () => {
      await request(app.getHttpServer())
        .post('/usuarios')
        .set('Cookie', adminCookies)
        .send({ nome: 'Filtro Audit', email: `filtro-${Date.now()}@test.local`, password: 'Senha@12345678' })
        .expect(201);

      const lista = await request(app.getHttpServer())
        .get('/auditoria?page=1&pageSize=10&modulo=usuarios')
        .set('Cookie', adminCookies);
      expect(lista.status).toBe(200);
      expect(lista.body.data.length).toBeGreaterThanOrEqual(1);
      expect(lista.body.total).toBeGreaterThanOrEqual(1);
    });
  });
});
