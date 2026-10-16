import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Ajuste de cadastro fiscal';

function cnpjDe(base12: string): string {
  for (let i = 0; i < 100; i += 1) {
    const candidato = `${base12}${String(i).padStart(2, '0')}`;
    if (validarCnpjAlfanumerico(candidato)) return candidato;
  }
  throw new Error(`CNPJ sem DV para ${base12}`);
}

function codigoDe(body: { message?: { codigo?: string } | string }): string | undefined {
  return typeof body.message === 'object' ? body.message.codigo : undefined;
}

describe('E01-T01 CNAEs', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let gestor = '';

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    const b = await createTestUser(app, { perfil: 'administrador' });
    const g = await createTestUser(app, { perfil: 'gestor' });
    adminA = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: b.adminEmail, password: b.adminPassword }));
    gestor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: g.adminEmail, password: g.adminPassword }));
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function base(sufixo: string) {
    const raiz = `CNAE${sufixo}`.padEnd(8, '0').slice(0, 8);
    const empresa = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', adminA)
      .send({ razaoSocial: `Empresa ${sufixo}`, cnpjRaiz: raiz, justificativa: MOTIVO });
    const estab = await request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', adminA)
      .send({
        empresaId: empresa.body.id,
        nome: 'Filial',
        cnpj: cnpjDe(`${raiz}0001`),
        inscricaoEstadual: '123',
        inscricaoMunicipal: '456',
        uf: 'SP',
        cnaes: [{ codigo: '6201501', descricao: 'Principal', tipo: 'PRINCIPAL' }],
        justificativa: MOTIVO,
      });
    return estab.body as { id: string; versao: number; situacao: string };
  }

  it('código repetido → 422 CNAE_DUPLICADO', async () => {
    const estab = await base('01');
    const res = await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({
        versao: estab.versao,
        justificativa: MOTIVO,
        cnaes: [
          { codigo: '6201501', descricao: 'A', tipo: 'PRINCIPAL' },
          { codigo: '6201-5/01', descricao: 'B', tipo: 'SECUNDARIA' },
        ],
      });
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('CNAE_DUPLICADO');
  });

  it('dois principais → 422 CNAE_PRINCIPAL_UNICO', async () => {
    const estab = await base('02');
    const res = await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({
        versao: estab.versao,
        justificativa: MOTIVO,
        cnaes: [
          { codigo: '6201501', descricao: 'A', tipo: 'PRINCIPAL' },
          { codigo: '6202300', descricao: 'B', tipo: 'PRINCIPAL' },
        ],
      });
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('CNAE_PRINCIPAL_UNICO');
  });

  it('aprovar sem principal → 422 CNAE_PRINCIPAL_AUSENTE', async () => {
    const estab = await base('03');
    const sem = await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({ versao: estab.versao, justificativa: MOTIVO, cnaes: [] });
    expect(sem.status).toBe(200);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: sem.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(422);
    expect(codigoDe(aprovado.body)).toBe('CNAE_PRINCIPAL_AUSENTE');
  });

  it('trocar principal na mesma lista → 200', async () => {
    const estab = await base('04');
    const res = await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({
        versao: estab.versao,
        justificativa: MOTIVO,
        cnaes: [
          { codigo: '6201501', descricao: 'Principal', tipo: 'SECUNDARIA' },
          { codigo: '6202300', descricao: 'Novo', tipo: 'PRINCIPAL' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.cnaes).toEqual(expect.arrayContaining([
      expect.objectContaining({ codigo: '6202300', tipo: 'PRINCIPAL' }),
      expect.objectContaining({ codigo: '6201501', tipo: 'SECUNDARIA' }),
    ]));
  });

  it('PUT cnaes com estabelecimento APPROVED → 409 ALTERACAO_EXIGIDA, REVIEW → 409 TRANSICAO_INVALIDA, SUSPENDED → 409 TRANSICAO_INVALIDA, sem escrita em estabelecimento_cnaes nem em auditoria', async () => {
    const db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const estab = await base('05');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.versao, justificativa: MOTIVO });
    const antesReview = await db.select({ id: schema.auditoria.id }).from(schema.auditoria);
    const emReview = await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({
        versao: submetido.body.versao,
        justificativa: MOTIVO,
        cnaes: [{ codigo: '6202300', descricao: 'Outro', tipo: 'PRINCIPAL' }],
      });
    expect(emReview.status).toBe(409);
    expect(codigoDe(emReview.body)).toBe('TRANSICAO_INVALIDA');
    const depoisReview = await db.select({ id: schema.auditoria.id }).from(schema.auditoria);
    expect(depoisReview.length).toBe(antesReview.length);

    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    const antesAprovado = await db.select({ id: schema.auditoria.id }).from(schema.auditoria);
    const emAprovado = await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({
        versao: aprovado.body.versao,
        justificativa: MOTIVO,
        cnaes: [{ codigo: '6202300', descricao: 'Outro', tipo: 'PRINCIPAL' }],
      });
    expect(emAprovado.status).toBe(409);
    expect(codigoDe(emAprovado.body)).toBe('ALTERACAO_EXIGIDA');
    const depoisAprovado = await db.select({ id: schema.auditoria.id }).from(schema.auditoria);
    expect(depoisAprovado.length).toBe(antesAprovado.length);

    const suspenso = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/suspender`)
      .set('Cookie', adminB)
      .send({ versao: aprovado.body.versao, justificativa: MOTIVO });
    const antesSuspenso = await db.select({ id: schema.auditoria.id }).from(schema.auditoria);
    const emSuspenso = await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({
        versao: suspenso.body.versao,
        justificativa: MOTIVO,
        cnaes: [{ codigo: '6202300', descricao: 'Outro', tipo: 'PRINCIPAL' }],
      });
    expect(emSuspenso.status).toBe(409);
    expect(codigoDe(emSuspenso.body)).toBe('TRANSICAO_INVALIDA');
    const depoisSuspenso = await db.select({ id: schema.auditoria.id }).from(schema.auditoria);
    expect(depoisSuspenso.length).toBe(antesSuspenso.length);
    const vigentes = await db.select().from(schema.estabelecimentoCnaes).where(and(
      eq(schema.estabelecimentoCnaes.estabelecimentoId, estab.id),
      eq(schema.estabelecimentoCnaes.codigo, '6201501'),
    ));
    expect(vigentes.some((linha) => linha.deletedAt === null)).toBe(true);
  });

  it('gestor → 403 em PUT cnaes', async () => {
    const estab = await base('06');
    const res = await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', gestor)
      .send({ versao: estab.versao, justificativa: MOTIVO, cnaes: [] });
    expect(res.status).toBe(403);
  });

  it('substituição grava DELETE/INSERT na auditoria com usuário e justificativa; linha removida mantém deleted_at', async () => {
    const db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
    const estab = await base('07');
    const res = await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({
        versao: estab.versao,
        justificativa: MOTIVO,
        cnaes: [{ codigo: '6202300', descricao: 'Novo', tipo: 'PRINCIPAL' }],
      });
    expect(res.status).toBe(200);
    const removidas = await db.select().from(schema.estabelecimentoCnaes).where(and(
      eq(schema.estabelecimentoCnaes.estabelecimentoId, estab.id),
      eq(schema.estabelecimentoCnaes.codigo, '6201501'),
    ));
    expect(removidas[0]?.deletedAt).toBeTruthy();
    const audits = await db.select().from(schema.auditoria).where(eq(schema.auditoria.tabela, 'estabelecimento_cnaes'));
    const desta = audits.filter((linha) => removidas.some((cnae) => cnae.id === linha.registroId) || linha.operacao === 'INSERT');
    expect(desta.some((linha) => linha.operacao === 'DELETE' && linha.justificativa === MOTIVO)).toBe(true);
    expect(desta.some((linha) => linha.operacao === 'INSERT' && linha.justificativa === MOTIVO && linha.usuarioId)).toBe(true);
  });

  it('histórico lista objeto cnae com usuarioNome', async () => {
    const estab = await base('08');
    await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({
        versao: estab.versao,
        justificativa: MOTIVO,
        cnaes: [{ codigo: '6202300', descricao: 'Novo', tipo: 'PRINCIPAL' }],
      });
    const res = await request(app.getHttpServer())
      .get(`/fiscal/estabelecimentos/${estab.id}/historico`)
      .set('Cookie', adminA);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ objeto: 'cnae', usuarioNome: expect.any(String) }),
    ]));
  });

  it('nenhuma chamada HTTP externa (fetch espionado)', async () => {
    const estab = await base('09');
    const spy = jest.spyOn(global, 'fetch');
    await request(app.getHttpServer())
      .put(`/fiscal/estabelecimentos/${estab.id}/cnaes`)
      .set('Cookie', adminA)
      .send({
        versao: estab.versao,
        justificativa: MOTIVO,
        cnaes: [{ codigo: '6202300', descricao: 'Novo', tipo: 'PRINCIPAL' }],
      });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
