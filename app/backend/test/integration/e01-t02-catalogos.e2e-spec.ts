import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Cadastro manual de código fiscal';
const EVENTO = 'enquadramento_fiscal_alterado';

function codigoDe(body: { message?: { codigo?: string } | string }): string | undefined {
  return typeof body.message === 'object' ? body.message.codigo : undefined;
}

describe('E01-T02 catálogos manuais de CFOP e NCM', () => {
  let app: INestApplication;
  let admin = '';
  let gestor = '';
  let spy: jest.SpiedFunction<EventEmitter2['emit']>;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    const g = await createTestUser(app, { perfil: 'gestor' });
    admin = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    gestor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: g.adminEmail, password: g.adminPassword }));
    spy = jest.spyOn(app.get(EventEmitter2), 'emit');
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    spy.mockClear();
    fetchSpy.mockClear();
  });

  afterAll(async () => {
    spy.mockRestore();
    fetchSpy.mockRestore();
    await cleanupDb(app);
    await app.close();
  });

  function eventosCatalogo() {
    return spy.mock.calls.filter((chamada) => chamada[0] === EVENTO);
  }

  it('CFOP duplicado → 409', async () => {
    const primeiro = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', admin)
      .send({ codigo: '5101', descricao: 'Venda de produção', justificativa: MOTIVO });
    expect(primeiro.status).toBe(201);
    expect(primeiro.body.codigo).toBe('5101');
    expect(eventosCatalogo()).toEqual([
      [EVENTO, expect.objectContaining({ acao: 'cfop_criado', enquadramentoId: primeiro.body.id })],
    ]);

    spy.mockClear();
    const segundo = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', admin)
      .send({ codigo: '5101', descricao: 'Outra descrição', justificativa: MOTIVO });
    expect(segundo.status).toBe(409);
    expect(codigoDe(segundo.body)).toBe('CFOP_DUPLICADO');
    expect(eventosCatalogo()).toHaveLength(0);
  });

  it('NCM duplicado → 409 e máscara normalizada', async () => {
    const primeiro = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', admin)
      .send({ codigo: '0201.30.00', descricao: 'Carnes bovinas', justificativa: MOTIVO });
    expect(primeiro.status).toBe(201);
    expect(primeiro.body.codigo).toBe('02013000');
    expect(eventosCatalogo()[0]?.[1]).toEqual(expect.objectContaining({ acao: 'ncm_criado' }));

    const segundo = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', admin)
      .send({ codigo: '02013000', descricao: 'Repetido', justificativa: MOTIVO });
    expect(segundo.status).toBe(409);
    expect(codigoDe(segundo.body)).toBe('NCM_DUPLICADO');
  });

  it('listagem não devolve removidos e o código volta a poder ser cadastrado', async () => {
    const criado = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', admin)
      .send({ codigo: '1102', descricao: 'Compra', justificativa: MOTIVO });
    expect(criado.status).toBe(201);
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    await db.update(schema.cfops).set({ deletedAt: new Date() }).where(eq(schema.cfops.id, criado.body.id));
    const lista = await request(app.getHttpServer()).get('/fiscal/cfops?search=1102').set('Cookie', admin);
    expect(lista.status).toBe(200);
    expect(lista.body.data.some((item: { codigo: string }) => item.codigo === '1102')).toBe(false);
    const deNovo = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', admin)
      .send({ codigo: '1102', descricao: 'Compra reaberta', justificativa: MOTIVO });
    expect(deNovo.status).toBe(201);
  });

  it('cada criação grava 1 auditoria INSERT e não chama HTTP externo', async () => {
    const antes = fetchSpy.mock.calls.length;
    const criado = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', admin)
      .send({ codigo: '02013010', descricao: 'Desossada', justificativa: MOTIVO });
    expect(criado.status).toBe(201);
    expect(fetchSpy.mock.calls.length).toBe(antes);
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const linhas = await db.select().from(schema.auditoria).where(eq(schema.auditoria.registroId, criado.body.id));
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toEqual(expect.objectContaining({
      tabela: 'ncms',
      operacao: 'INSERT',
      modulo: 'fiscal.enquadramentos',
      justificativa: MOTIVO,
    }));
  });

  it('formato inválido → 400 e gestor → 403', async () => {
    const invalido = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', admin)
      .send({ codigo: 'ABC', descricao: 'Inválido', justificativa: MOTIVO });
    expect(invalido.status).toBe(400);
    const negado = await request(app.getHttpServer()).get('/fiscal/cfops').set('Cookie', gestor);
    expect(negado.status).toBe(403);
    const negadoPost = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', gestor)
      .send({ codigo: '02013000', descricao: 'Sem permissão', justificativa: MOTIVO });
    expect(negadoPost.status).toBe(403);
  });
});
