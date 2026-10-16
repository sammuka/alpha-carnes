import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Ajuste de cadastro fiscal';
const CNAES = [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }];

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

function mascarar(c: string): string {
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

describe('E01-T01 achados do Portão A r1', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    const b = await createTestUser(app, { perfil: 'administrador' });
    adminA = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: b.adminEmail, password: b.adminPassword }));
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function aprovado(raiz: string, razao: string) {
    const empresa = await http().post('/fiscal/empresas').set('Cookie', adminA)
      .send({ razaoSocial: razao, cnpjRaiz: raiz, justificativa: MOTIVO });
    expect(empresa.status).toBe(201);
    const cnpj = cnpjDe(`${raiz}0001`);
    const estab = await http().post('/fiscal/estabelecimentos').set('Cookie', adminA).send({
      empresaId: empresa.body.id, nome: 'Filial', cnpj, inscricaoEstadual: '123', inscricaoMunicipal: '456',
      uf: 'SP', cnaes: CNAES, justificativa: MOTIVO,
    });
    expect(estab.status).toBe(201);
    const sub = await http().post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`).set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const apr = await http().post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`).set('Cookie', adminB)
      .send({ versao: sub.body.versao, justificativa: MOTIVO });
    expect(apr.status).toBe(200);
    return { empresaId: empresa.body.id as string, id: estab.body.id as string, versao: apr.body.versao as number, cnpj };
  }

  async function regimeAprovado(estabId: string, inicio: string) {
    const r = await http().post(`/fiscal/estabelecimentos/${estabId}/regimes`).set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: inicio, justificativa: MOTIVO });
    expect(r.status).toBe(201);
    const s = await http().post(`/fiscal/estabelecimentos/${estabId}/regimes/${r.body.id}/submeter`).set('Cookie', adminA)
      .send({ versao: r.body.versao, justificativa: MOTIVO });
    const a = await http().post(`/fiscal/estabelecimentos/${estabId}/regimes/${r.body.id}/aprovar`).set('Cookie', adminB)
      .send({ versao: s.body.versao, justificativa: MOTIVO });
    expect(a.status).toBe(200);
  }

  it('B1: KPI Em revisão respeita empresa, situação e busca', async () => {
    const alfa = await aprovado('81ABC001', 'Alfa Contagem');
    const beta = await aprovado('81ABC002', 'Beta Contagem');
    const alt = await http().post(`/fiscal/estabelecimentos/${beta.id}/alteracoes`).set('Cookie', adminA).send({
      nome: 'Filial Nova', inscricaoEstadual: '123', inscricaoMunicipal: '456', uf: 'RJ', cnaes: CNAES,
      versao: beta.versao, justificativa: MOTIVO,
    });
    expect(alt.status).toBe(201);
    const sub = await http().post(`/fiscal/estabelecimentos/${beta.id}/alteracoes/${alt.body.id}/submeter`)
      .set('Cookie', adminA).send({ versao: alt.body.versao, justificativa: MOTIVO });
    expect(sub.status).toBe(200);

    const contar = async (qs: string) => (await http().get(`/fiscal/estabelecimentos/contagens?${qs}`).set('Cookie', adminA)).body;
    expect(await contar(`empresaId=${beta.empresaId}`)).toEqual({ total: 1, emRevisao: 1, suspensos: 0 });
    expect(await contar(`empresaId=${alfa.empresaId}`)).toEqual({ total: 1, emRevisao: 0, suspensos: 0 });
    expect(await contar('search=zzzzqq')).toEqual({ total: 0, emRevisao: 0, suspensos: 0 });
    expect((await contar('search=Beta%20Contagem')).emRevisao).toBe(1);
    expect((await contar(`empresaId=${beta.empresaId}&situacao=SUSPENDED`)).emRevisao).toBe(0);
  });

  it('B2: todo INSERT da fatia grava dados_anteriores vazio', async () => {
    const ctx = await aprovado('81ABC003', 'Gama Auditoria');
    await regimeAprovado(ctx.id, '2020-01-01');
    const alt = await http().post(`/fiscal/estabelecimentos/${ctx.id}/alteracoes`).set('Cookie', adminA).send({
      nome: 'Filial Nova', inscricaoEstadual: '123', inscricaoMunicipal: '456', uf: 'RJ', cnaes: CNAES,
      versao: ctx.versao, justificativa: MOTIVO,
    });
    expect(alt.status).toBe(201);
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const inserts = await db.select().from(schema.auditoria)
      .where(inArray(schema.auditoria.tabela, [
        'empresas', 'estabelecimentos', 'estabelecimento_cnaes', 'regimes_tributarios',
        'estabelecimento_alteracoes', 'estabelecimento_alteracao_cnaes',
      ]));
    const meus = inserts.filter((l) => l.operacao === 'INSERT');
    expect(new Set(meus.map((l) => l.tabela))).toEqual(new Set([
      'empresas', 'estabelecimentos', 'estabelecimento_cnaes', 'regimes_tributarios',
      'estabelecimento_alteracoes', 'estabelecimento_alteracao_cnaes',
    ]));
    for (const linha of meus) expect({ tabela: linha.tabela, antes: linha.dadosAnteriores }).toEqual({ tabela: linha.tabela, antes: {} });
    const [reg] = meus.filter((l) => l.tabela === 'regimes_tributarios');
    expect(reg?.registroId).toBeTruthy();
  });

  it('3: busca por CNPJ mascarado encontra o estabelecimento; razão social segue funcionando', async () => {
    const ctx = await aprovado('81ABC004', 'Delta Busca');
    const mascarada = await http().get(`/fiscal/estabelecimentos?search=${encodeURIComponent(mascarar(ctx.cnpj))}`).set('Cookie', adminA);
    expect(mascarada.body.data.map((l: { id: string }) => l.id)).toEqual([ctx.id]);
    const parcial = await http().get(`/fiscal/estabelecimentos?search=${encodeURIComponent('81.ABC')}`).set('Cookie', adminA);
    expect(parcial.body.data.map((l: { id: string }) => l.id)).toContain(ctx.id);
    const razao = await http().get('/fiscal/estabelecimentos?search=Delta%20Busca').set('Cookie', adminA);
    expect(razao.body.data.map((l: { id: string }) => l.id)).toEqual([ctx.id]);
    const contagem = await http().get(`/fiscal/estabelecimentos/contagens?search=${encodeURIComponent(mascarar(ctx.cnpj))}`).set('Cookie', adminA);
    expect(contagem.body.total).toBe(1);
  });

  it('5 e 8: U+0000, ano 0000 e CNPJ não ASCII → 400, nunca 500', async () => {
    const ctx = await aprovado('81ABC005', 'Epsilon Entrada');
    const nulo = String.fromCharCode(0);
    const emp = await http().post('/fiscal/empresas').set('Cookie', adminA)
      .send({ razaoSocial: `Ruim${nulo}`, cnpjRaiz: '81ABC006', justificativa: MOTIVO });
    expect(emp.status).toBe(400);
    const just = await http().post('/fiscal/empresas').set('Cookie', adminA)
      .send({ razaoSocial: 'Ok', cnpjRaiz: '81ABC006', justificativa: `abc${nulo}` });
    expect(just.status).toBe(400);
    expect((await http().get(`/fiscal/estabelecimentos?search=a%00b`).set('Cookie', adminA)).status).toBe(400);
    const data = await http().post(`/fiscal/estabelecimentos/${ctx.id}/regimes`).set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: '0000-01-01', justificativa: MOTIVO });
    expect(data.status).toBe(400);
    const dataFim = await http().post(`/fiscal/estabelecimentos/${ctx.id}/regimes`).set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: '2020-01-01', vigenciaFim: '0000-12-31', justificativa: MOTIVO });
    expect(dataFim.status).toBe(400);
    const naoAscii = await http().post('/fiscal/estabelecimentos').set('Cookie', adminA).send({
      empresaId: ctx.empresaId, nome: 'X', cnpj: 'ı1ABC0060001' + '00', inscricaoEstadual: '1', inscricaoMunicipal: '1',
      uf: 'SP', justificativa: MOTIVO,
    });
    expect(naoAscii.status).toBe(400);
    const raiz = await http().post('/fiscal/empresas').set('Cookie', adminA)
      .send({ razaoSocial: 'Ok', cnpjRaiz: 'ßABC0060', justificativa: MOTIVO });
    expect(raiz.status).toBe(400);
  });

  it('6: challenge de troca informa o período sem regime após o fim da nova versão', async () => {
    const ctx = await aprovado('81ABC007', 'Zeta Troca');
    await regimeAprovado(ctx.id, '2020-01-01');
    const nova = await http().post(`/fiscal/estabelecimentos/${ctx.id}/regimes`).set('Cookie', adminA)
      .send({ crt: '1', vigenciaInicio: '2026-10-01', vigenciaFim: '2026-12-31', justificativa: MOTIVO });
    const desafio = await http().post(`/fiscal/estabelecimentos/${ctx.id}/regimes/${nova.body.id}/submeter`).set('Cookie', adminA)
      .send({ versao: nova.body.versao, justificativa: MOTIVO });
    expect(desafio.status).toBe(409);
    expect(codigoDe(desafio.body)).toBe('TROCA_REGIME_CONFIRMACAO_NECESSARIA');
    expect(desafio.body.message.fimProposto).toBe('2026-09-30');
    expect(desafio.body.message.semRegimeAPartirDe).toBe('2027-01-01');
  });
});
