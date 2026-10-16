import { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Cadastro manual de formato.';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-/i;

describe('E01-T03 catálogos manuais de benefício e classificação', () => {
  let app: INestApplication;
  let admin = '';
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    admin = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({
      email: a.adminEmail,
      password: a.adminPassword,
    }));
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  beforeEach(async () => {
    await db().execute(sql`DELETE FROM beneficios_fiscais`);
    await db().execute(sql`DELETE FROM classificacoes_ibs_cbs`);
    await db().execute(sql`DELETE FROM auditoria WHERE modulo = 'fiscal.regras'`);
    fetchSpy.mockClear();
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    await cleanupDb(app);
    await app.close();
  });

  function db() {
    return app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
  }

  it('benefício novo entra na lista pela descrição e o duplicado responde 409', async () => {
    const primeiro = await request(app.getHttpServer())
      .post('/fiscal/beneficios-fiscais')
      .set('Cookie', admin)
      .send({
        codigo: 'SP020450',
        descricao: 'Redução de base — São Paulo (SP020450)',
        justificativa: MOTIVO,
      });
    expect(primeiro.status).toBe(201);
    const lista = await request(app.getHttpServer())
      .get('/fiscal/beneficios-fiscais')
      .set('Cookie', admin);
    expect(lista.status).toBe(200);
    const texto = JSON.stringify(lista.body.data.map((item: { codigo: string; descricao: string }) => ({
      codigo: item.codigo,
      descricao: item.descricao,
    })));
    expect(texto).toContain('Redução de base — São Paulo (SP020450)');
    expect(texto).not.toMatch(UUID);
    expect(lista.body.data[0]).toHaveProperty('id');

    const segundo = await request(app.getHttpServer())
      .post('/fiscal/beneficios-fiscais')
      .set('Cookie', admin)
      .send({
        codigo: 'SP020450',
        descricao: 'Outra descrição',
        justificativa: MOTIVO,
      });
    expect(segundo.status).toBe(409);
    const contagem = await db().execute(sql`SELECT COUNT(*)::int AS n FROM beneficios_fiscais`);
    expect(contagem.rows[0]).toMatchObject({ n: 1 });
  });

  it('benefício SP1 é 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/fiscal/beneficios-fiscais')
      .set('Cookie', admin)
      .send({ codigo: 'SP1', descricao: 'Curto', justificativa: MOTIVO });
    expect(res.status).toBe(400);
  });

  it('classificação 000001 entra e a duplicata responde 409', async () => {
    const primeiro = await request(app.getHttpServer())
      .post('/fiscal/classificacoes-ibs-cbs')
      .set('Cookie', admin)
      .send({ codigo: '000001', descricao: 'Tributação integral (000001)', justificativa: MOTIVO });
    expect(primeiro.status).toBe(201);
    const segundo = await request(app.getHttpServer())
      .post('/fiscal/classificacoes-ibs-cbs')
      .set('Cookie', admin)
      .send({ codigo: '000001', descricao: 'Repetida', justificativa: MOTIVO });
    expect(segundo.status).toBe(409);
    const contagem = await db().execute(sql`SELECT COUNT(*)::int AS n FROM classificacoes_ibs_cbs`);
    expect(contagem.rows[0]).toMatchObject({ n: 1 });
  });

  it('cada POST grava uma auditoria e não chama HTTP externo', async () => {
    const criado = await request(app.getHttpServer())
      .post('/fiscal/beneficios-fiscais')
      .set('Cookie', admin)
      .send({
        codigo: 'SP020450',
        descricao: 'Redução de base — São Paulo (SP020450)',
        justificativa: MOTIVO,
      });
    expect(criado.status).toBe(201);
    expect(fetchSpy).not.toHaveBeenCalled();
    const linhas = await db().select().from(schema.auditoria).where(sql`${schema.auditoria.registroId} = ${criado.body.id}`);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.modulo).toBe('fiscal.regras');
  });
});
