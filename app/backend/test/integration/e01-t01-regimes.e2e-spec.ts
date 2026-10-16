import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq } from 'drizzle-orm';
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

describe('E01-T01 regimes tributários', () => {
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

  async function estabelecimento(raiz: string, aprovar: boolean) {
    const empresa = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', adminA)
      .send({ razaoSocial: 'Alpha Carnes LTDA', cnpjRaiz: raiz, justificativa: MOTIVO });
    expect(empresa.status).toBe(201);
    const estab = await request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', adminA)
      .send({
        empresaId: empresa.body.id,
        nome: 'Filial Osasco',
        cnpj: cnpjDe(`${raiz}0001`),
        inscricaoEstadual: '123456789',
        inscricaoMunicipal: '98765',
        uf: 'SP',
        cnaes: [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }],
        justificativa: MOTIVO,
      });
    expect(estab.status).toBe(201);
    if (!aprovar) return estab.body as { id: string; versao: number };
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    return aprovado.body as { id: string; versao: number };
  }

  async function criarRegime(estabId: string, inicio: string, fim?: string) {
    return request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estabId}/regimes`)
      .set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: inicio, ...(fim ? { vigenciaFim: fim } : {}), justificativa: MOTIVO });
  }

  async function lerFim(id: string) {
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const [linha] = await db.select().from(schema.regimesTributarios).where(eq(schema.regimesTributarios.id, id));
    return linha;
  }

  it('criar, editar, submeter, aprovar, rejeitar, remover', async () => {
    const estab = await estabelecimento('41ABC001', true);
    const criado = await criarRegime(estab.id, '2026-01-01', '2026-06-30');
    expect(criado.status).toBe(201);
    expect(criado.body.situacao).toBe('DRAFT');
    const editado = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}`)
      .set('Cookie', adminA)
      .send({ crt: '1', versao: criado.body.versao, justificativa: MOTIVO });
    expect(editado.status).toBe(200);
    expect(editado.body.crt).toBe('1');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: editado.body.versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    expect(submetido.body.situacao).toBe('REVIEW');
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    expect(aprovado.body.situacao).toBe('APPROVED');

    const outro = await criarRegime(estab.id, '2026-07-01', '2026-12-31');
    const submetidoOutro = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${outro.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: outro.body.versao, justificativa: MOTIVO });
    const rejeitado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${outro.body.id}/rejeitar`)
      .set('Cookie', adminB)
      .send({ versao: submetidoOutro.body.versao, justificativa: MOTIVO });
    expect(rejeitado.status).toBe(200);
    expect(rejeitado.body.situacao).toBe('REJECTED');
    const removido = await request(app.getHttpServer())
      .delete(`/fiscal/estabelecimentos/${estab.id}/regimes/${outro.body.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(removido.status).toBe(200);
    expect((await lerFim(outro.body.id))?.deletedAt).toBeTruthy();
  });

  it('sobreposição com REVIEW → 409', async () => {
    const estab = await estabelecimento('41ABC002', true);
    const aberto = await criarRegime(estab.id, '2026-01-01');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${aberto.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: aberto.body.versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    const novo = await criarRegime(estab.id, '2026-06-01');
    const conflito = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${novo.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: novo.body.versao, justificativa: MOTIVO });
    expect(conflito.status).toBe(409);
    expect(codigoDe(conflito.body)).toBe('REGIME_SOBREPOSTO');
    expect(conflito.body.message.conflito.situacao).toBe('REVIEW');
    const depois = await lerFim(novo.body.id);
    expect(depois?.situacao).toBe('DRAFT');
    expect(depois?.versao).toBe(novo.body.versao);
  });

  it('APPROVED com fim futuro interceptado → 409 REGIME_SOBREPOSTO e vigencia_fim inalterada', async () => {
    const estab = await estabelecimento('41ABC003', true);
    const atual = await criarRegime(estab.id, '2026-01-01', '2026-12-31');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${atual.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: atual.body.versao, justificativa: MOTIVO });
    await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${atual.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    const novo = await criarRegime(estab.id, '2026-06-01', '2026-08-01');
    const conflito = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${novo.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: novo.body.versao, justificativa: MOTIVO });
    expect(conflito.status).toBe(409);
    expect(codigoDe(conflito.body)).toBe('REGIME_SOBREPOSTO');
    expect((await lerFim(atual.body.id))?.vigenciaFim).toBe('2026-12-31');
  });

  it('sem confirmação → 409 sem mutação', async () => {
    const estab = await estabelecimento('41ABC004', true);
    const atual = await criarRegime(estab.id, '2020-01-01');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${atual.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: atual.body.versao, justificativa: MOTIVO });
    await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${atual.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    const novo = await criarRegime(estab.id, '2026-10-01');
    const desafio = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${novo.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: novo.body.versao, justificativa: MOTIVO });
    expect(desafio.status).toBe(409);
    expect(codigoDe(desafio.body)).toBe('TROCA_REGIME_CONFIRMACAO_NECESSARIA');
    expect(desafio.body.message.fimProposto).toBe('2026-09-30');
    const depois = await lerFim(novo.body.id);
    expect(depois?.situacao).toBe('DRAFT');
    expect(depois?.versao).toBe(novo.body.versao);
    expect((await lerFim(atual.body.id))?.vigenciaFim).toBeNull();
  });

  it('confirmada e aprovada fecha anterior em D−1 na mesma transação', async () => {
    const estab = await estabelecimento('41ABC005', true);
    const atual = await criarRegime(estab.id, '2020-01-01');
    const submetidoAtual = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${atual.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: atual.body.versao, justificativa: MOTIVO });
    await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${atual.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetidoAtual.body.versao, justificativa: MOTIVO });
    const novo = await criarRegime(estab.id, '2026-10-01');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${novo.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: novo.body.versao, justificativa: MOTIVO, confirmarTroca: true });
    expect(submetido.status).toBe(200);
    expect(submetido.body.situacao).toBe('REVIEW');
    expect(submetido.body.substituiRegimeId).toBe(atual.body.id);
    expect((await lerFim(atual.body.id))?.vigenciaFim).toBeNull();
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${novo.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    expect(aprovado.body.situacao).toBe('APPROVED');
    expect((await lerFim(atual.body.id))?.vigenciaFim).toBe('2026-09-30');
    expect((await lerFim(atual.body.id))?.situacao).toBe('APPROVED');
  });

  it('estabelecimento não aprovado → 422', async () => {
    const estab = await estabelecimento('41ABC006', false);
    const criado = await criarRegime(estab.id, '2026-01-01', '2026-12-31');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criado.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(422);
    expect(codigoDe(aprovado.body)).toBe('ESTABELECIMENTO_NAO_APROVADO');
  });

  it('regime de outro estabelecimento → 404', async () => {
    const a = await estabelecimento('41ABC007', true);
    const b = await estabelecimento('41ABC008', true);
    const regime = await criarRegime(a.id, '2026-01-01', '2026-06-30');
    const alheio = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${b.id}/regimes/${regime.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: regime.body.versao, justificativa: MOTIVO });
    expect(alheio.status).toBe(404);
  });

  it('criação em suspenso, vigência inválida, omissão de CRT e transições inválidas', async () => {
    const suspensoBase = await estabelecimento('42ABC001', true);
    const suspenso = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${suspensoBase.id}/suspender`)
      .set('Cookie', adminB)
      .send({ versao: suspensoBase.versao, justificativa: MOTIVO });
    expect(suspenso.status).toBe(200);
    const noSuspenso = await criarRegime(suspensoBase.id, '2026-01-01', '2026-12-31');
    expect(noSuspenso.status).toBe(409);
    expect(codigoDe(noSuspenso.body)).toBe('TRANSICAO_INVALIDA');

    const estab = await estabelecimento('42ABC002', true);
    const criado = await criarRegime(estab.id, '2026-01-01', '2026-06-30');
    expect(criado.status).toBe(201);
    const semCrt = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}`)
      .set('Cookie', adminA)
      .send({ vigenciaInicio: '2026-01-02', versao: criado.body.versao, justificativa: MOTIVO });
    expect(semCrt.status).toBe(200);
    expect(semCrt.body.crt).toBe('3');
    const vigencia = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}`)
      .set('Cookie', adminA)
      .send({ vigenciaInicio: '2026-07-01', versao: semCrt.body.versao, justificativa: MOTIVO });
    expect(vigencia.status).toBe(422);
    expect(codigoDe(vigencia.body)).toBe('VIGENCIA_INVALIDA');
    const versao = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}`)
      .set('Cookie', adminA)
      .send({ crt: '1', versao: semCrt.body.versao + 5, justificativa: MOTIVO });
    expect(versao.status).toBe(409);
    expect(codigoDe(versao.body)).toBe('CONFLITO_CONCORRENTE');
    const aprovarCedo = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: semCrt.body.versao, justificativa: MOTIVO });
    expect(aprovarCedo.status).toBe(409);
    expect(codigoDe(aprovarCedo.body)).toBe('TRANSICAO_INVALIDA');
    const rejeitarCedo = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}/rejeitar`)
      .set('Cookie', adminB)
      .send({ versao: semCrt.body.versao, justificativa: MOTIVO });
    expect(rejeitarCedo.status).toBe(409);
    expect(codigoDe(rejeitarCedo.body)).toBe('TRANSICAO_INVALIDA');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: semCrt.body.versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    const deNovo = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(deNovo.status).toBe(409);
    expect(codigoDe(deNovo.body)).toBe('TRANSICAO_INVALIDA');
    const editado = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}`)
      .set('Cookie', adminA)
      .send({ crt: '2', versao: submetido.body.versao, justificativa: MOTIVO });
    expect(editado.status).toBe(409);
    expect(codigoDe(editado.body)).toBe('TRANSICAO_INVALIDA');
    const rejeitado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}/rejeitar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(rejeitado.status).toBe(200);
    const reeditado = await request(app.getHttpServer())
      .patch(`/fiscal/estabelecimentos/${estab.id}/regimes/${criado.body.id}`)
      .set('Cookie', adminA)
      .send({ versao: rejeitado.body.versao, justificativa: MOTIVO });
    expect(reeditado.status).toBe(200);
    expect(reeditado.body.situacao).toBe('DRAFT');
    expect(reeditado.body.crt).toBe('3');
  });

  it('remover regime em revisão e aprovar período que passou a sobrepor', async () => {
    const estab = await estabelecimento('42ABC003', true);
    const revisao = await criarRegime(estab.id, '2027-01-01', '2027-06-30');
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${revisao.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: revisao.body.versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    const removido = await request(app.getHttpServer())
      .delete(`/fiscal/estabelecimentos/${estab.id}/regimes/${revisao.body.id}`)
      .set('Cookie', adminA)
      .send({ justificativa: MOTIVO });
    expect(removido.status).toBe(409);
    expect(codigoDe(removido.body)).toBe('TRANSICAO_INVALIDA');

    const atual = await criarRegime(estab.id, '2026-01-01', '2026-06-30');
    const submetidoAtual = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${atual.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: atual.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${atual.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetidoAtual.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    const novo = await criarRegime(estab.id, '2026-07-01', '2026-12-31');
    const submetidoNovo = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${novo.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: novo.body.versao, justificativa: MOTIVO });
    expect(submetidoNovo.status).toBe(200);
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    await db.update(schema.regimesTributarios)
      .set({ vigenciaFim: '2026-12-31' })
      .where(eq(schema.regimesTributarios.id, atual.body.id));
    const conflito = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.id}/regimes/${novo.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetidoNovo.body.versao, justificativa: MOTIVO });
    expect(conflito.status).toBe(409);
    expect(codigoDe(conflito.body)).toBe('REGIME_SOBREPOSTO');
    expect((await lerFim(novo.body.id))?.situacao).toBe('REVIEW');
  });
});
