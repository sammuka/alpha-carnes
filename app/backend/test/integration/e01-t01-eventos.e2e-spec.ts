import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { EVENTOS } from '../../src/realtime/events/eventos';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Ajuste de cadastro fiscal';
const FISCAIS = [
  EVENTOS.EMPRESA_FISCAL_ALTERADA,
  EVENTOS.ESTABELECIMENTO_FISCAL_ALTERADO,
  EVENTOS.REGIME_TRIBUTARIO_ALTERADO,
];

function cnpjDe(base12: string): string {
  for (let i = 0; i < 100; i += 1) {
    const candidato = `${base12}${String(i).padStart(2, '0')}`;
    if (validarCnpjAlfanumerico(candidato)) return candidato;
  }
  throw new Error(`CNPJ sem DV para ${base12}`);
}

describe('E01-T01 eventos pós-commit', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let spy: jest.SpiedFunction<EventEmitter2['emit']>;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    const b = await createTestUser(app, { perfil: 'administrador' });
    adminA = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: b.adminEmail, password: b.adminPassword }));
    spy = jest.spyOn(app.get(EventEmitter2), 'emit');
  });

  afterEach(() => spy.mockClear());

  afterAll(async () => {
    spy.mockRestore();
    await cleanupDb(app);
    await app.close();
  });

  function chamadasFiscais() {
    return spy.mock.calls.filter((chamada) => FISCAIS.includes(chamada[0] as typeof FISCAIS[number]));
  }

  async function empresa(raiz: string) {
    const res = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', adminA)
      .send({ razaoSocial: 'Alpha Carnes LTDA', cnpjRaiz: raiz, justificativa: MOTIVO });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function estab(empresaId: string, cnpj: string) {
    return request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', adminA)
      .send({
        empresaId,
        nome: 'Filial Osasco',
        cnpj,
        inscricaoEstadual: '123456789',
        inscricaoMunicipal: '98765',
        uf: 'SP',
        cnaes: [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }],
        justificativa: MOTIVO,
      });
  }

  it('1 evento depois do commit', async () => {
    const { db } = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE);
    const visivel = new Promise<boolean>((resolve) => {
      app.get(EventEmitter2).once(EVENTOS.ESTABELECIMENTO_FISCAL_ALTERADO, (payload: { estabelecimentoId?: string; acao: string }) => {
        void db
          .select({ id: schema.estabelecimentos.id })
          .from(schema.estabelecimentos)
          .where(eq(schema.estabelecimentos.id, payload.estabelecimentoId ?? ''))
          .then((linhas) => resolve(payload.acao === 'criado' && linhas.length === 1));
      });
    });
    spy.mockClear();
    const criado = await estab(await empresa('61ABC001'), cnpjDe('61ABC0010001'));
    expect(criado.status).toBe(201);
    const fiscais = chamadasFiscais().filter((chamada) => chamada[0] === EVENTOS.ESTABELECIMENTO_FISCAL_ALTERADO);
    expect(fiscais).toHaveLength(1);
    expect(await visivel).toBe(true);
  });

  it('409/422 não emitem', async () => {
    const empresaId = await empresa('61ABC002');
    spy.mockClear();
    const cnpj = cnpjDe('61ABC0020001');
    const primeiro = await estab(empresaId, cnpj);
    expect(primeiro.status).toBe(201);
    spy.mockClear();
    const duplicado = await estab(empresaId, cnpj);
    expect(duplicado.status).toBe(409);
    expect(chamadasFiscais()).toHaveLength(0);

    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${primeiro.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: primeiro.body.versao, justificativa: MOTIVO });
    spy.mockClear();
    const negado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${primeiro.body.id}/aprovar`)
      .set('Cookie', adminA)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(negado.status).toBe(422);
    expect(chamadasFiscais()).toHaveLength(0);
  });

  it('troca emite dois', async () => {
    const empresaId = await empresa('61ABC003');
    const criado = await estab(empresaId, cnpjDe('61ABC0030001'));
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criado.body.versao, justificativa: MOTIVO });
    await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    const aberto = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/regimes`)
      .set('Cookie', adminA)
      .send({ crt: '3', vigenciaInicio: '2020-01-01', justificativa: MOTIVO });
    const submetidoAberto = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/regimes/${aberto.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: aberto.body.versao, justificativa: MOTIVO });
    await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/regimes/${aberto.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetidoAberto.body.versao, justificativa: MOTIVO });
    const novo = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/regimes`)
      .set('Cookie', adminA)
      .send({ crt: '1', vigenciaInicio: '2026-10-01', justificativa: MOTIVO });
    const submetidoNovo = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/regimes/${novo.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: novo.body.versao, justificativa: MOTIVO, confirmarTroca: true });
    spy.mockClear();
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/regimes/${novo.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetidoNovo.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    const trocas = chamadasFiscais().filter((chamada) => chamada[0] === EVENTOS.REGIME_TRIBUTARIO_ALTERADO);
    expect(trocas.map((chamada) => (chamada[1] as { acao: string }).acao)).toEqual(['atualizado', 'aprovado']);
  });

  it('aprovar alteração emite alteracao_aprovada', async () => {
    const empresaId = await empresa('61ABC004');
    const criado = await estab(empresaId, cnpjDe('61ABC0040001'));
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criado.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    const alteracao = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/alteracoes`)
      .set('Cookie', adminA)
      .send({
        nome: 'Filial Barueri',
        inscricaoEstadual: '555444333',
        inscricaoMunicipal: '111',
        uf: 'RJ',
        cnaes: [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }],
        versao: aprovado.body.versao,
        justificativa: MOTIVO,
      });
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/alteracoes/${alteracao.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: alteracao.body.versao, justificativa: MOTIVO });
    spy.mockClear();
    const decisao = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.body.id}/alteracoes/${alteracao.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(decisao.status).toBe(200);
    const eventos = chamadasFiscais();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.[0]).toBe(EVENTOS.ESTABELECIMENTO_FISCAL_ALTERADO);
    expect((eventos[0]?.[1] as { acao: string }).acao).toBe('alteracao_aprovada');
  });
});
