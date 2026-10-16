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

const MOTIVO = 'Cadastro de enquadramento fiscal';

function cnpjDe(base12: string): string {
  for (let i = 0; i < 100; i += 1) {
    const candidato = `${base12}${String(i).padStart(2, '0')}`;
    if (validarCnpjAlfanumerico(candidato)) return candidato;
  }
  throw new Error(`CNPJ sem DV para ${base12}`);
}

function cnpjNumerico(base12: string): string {
  const digitos = base12.split('').map(Number);
  const calcular = (qtd: number): void => {
    let soma = 0;
    let peso = 2;
    for (let i = qtd - 1; i >= 0; i -= 1) {
      soma += (digitos[i] ?? 0) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    digitos.push(resto < 2 ? 0 : 11 - resto);
  };
  calcular(12);
  calcular(13);
  return digitos.join('');
}

describe('E01-T02 eventos pós-commit', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let seq = 0;
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

  function db() {
    return app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
  }

  function chamadasEnquadramento() {
    return spy.mock.calls.filter((chamada) => chamada[0] === EVENTOS.ENQUADRAMENTO_FISCAL_ALTERADO);
  }

  function raiz(): string {
    seq += 1;
    return `81EV${String(seq).padStart(4, '0')}`;
  }

  async function baseAprovada() {
    const cnpjRaiz = raiz();
    const empresa = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', adminA)
      .send({ razaoSocial: `Empresa ${cnpjRaiz}`, cnpjRaiz, justificativa: MOTIVO });
    expect(empresa.status).toBe(201);
    const estab = await request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', adminA)
      .send({
        empresaId: empresa.body.id,
        nome: 'Filial Osasco',
        cnpj: cnpjDe(`${cnpjRaiz}0001`),
        inscricaoEstadual: '123456789',
        inscricaoMunicipal: '98765',
        uf: 'SP',
        cnaes: [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }],
        justificativa: MOTIVO,
      });
    expect(estab.status).toBe(201);
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    const operacao = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', adminA)
      .send({ data: `2098-02-${String(seq).padStart(2, '0')}`, rotulo: `Compra ${cnpjRaiz}` });
    expect(operacao.status).toBe(201);
    const produto = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminA)
      .send({ codigo: `P-${cnpjRaiz}`, nome: 'Acém', unidadePedido: 'kg' });
    expect(produto.status).toBe(201);
    const cliente = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminA)
      .send({
        codigo: `C-${cnpjRaiz}`,
        razaoSocial: 'Açougue Central LTDA',
        nomeFantasia: 'Açougue Central',
        documentoFiscal: cnpjNumerico(`7${String(seq).padStart(11, '0')}`),
        faixaPreco: 'A',
      });
    expect(cliente.status).toBe(201);
    const cfop = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', adminA)
      .send({ codigo: String(7100 + seq).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(cfop.status).toBe(201);
    const ncm = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', adminA)
      .send({ codigo: String(31000000 + seq).padStart(8, '0'), descricao: `NCM ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(ncm.status).toBe(201);
    return {
      estabelecimentoId: aprovado.body.id as string,
      empresaId: empresa.body.id as string,
      operacaoId: operacao.body.id as string,
      produtoId: produto.body.id as string,
      clienteId: cliente.body.id as string,
      cfopId: cfop.body.id as string,
      ncmId: ncm.body.id as string,
    };
  }

  function corpo(base: Awaited<ReturnType<typeof baseAprovada>>, extra: Record<string, unknown> = {}) {
    return {
      estabelecimentoId: base.estabelecimentoId,
      operacaoId: base.operacaoId,
      tpNf: '1',
      finNfe: '1',
      cfopId: base.cfopId,
      abrangencia: 'INTERNA',
      tipoProduto: 'REVENDA',
      produtoId: base.produtoId,
      ncmId: base.ncmId,
      cest: '1708700',
      clienteId: base.clienteId,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
      prioridade: 1,
      justificativa: MOTIVO,
      ...extra,
    };
  }

  it('1 evento depois do commit', async () => {
    const base = await baseAprovada();
    const visivel = new Promise<boolean>((resolve) => {
      app.get(EventEmitter2).once(EVENTOS.ENQUADRAMENTO_FISCAL_ALTERADO, (payload: { enquadramentoId?: string; acao: string }) => {
        void db()
          .select({ id: schema.enquadramentosFiscais.id })
          .from(schema.enquadramentosFiscais)
          .where(eq(schema.enquadramentosFiscais.id, payload.enquadramentoId ?? ''))
          .then((linhas) => resolve(payload.acao === 'criado' && linhas.length === 1));
      });
    });
    spy.mockClear();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    const eventos = chamadasEnquadramento();
    expect(eventos).toHaveLength(1);
    const payload = eventos[0]?.[1] as { acao: string; enquadramentoId: string; estabelecimentoId: string; empresaId: string };
    expect(payload).toEqual(expect.objectContaining({
      acao: 'criado',
      enquadramentoId: criado.body.id,
      estabelecimentoId: base.estabelecimentoId,
      empresaId: base.empresaId,
      situacao: 'ATIVA',
    }));
    expect(JSON.stringify(payload)).not.toMatch(/cst|aliquota|ibs|cbs/i);
    expect(await visivel).toBe(true);
  });

  it('422 da consulta não emite', async () => {
    const base = await baseAprovada();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    spy.mockClear();
    const consulta = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos/consulta')
      .set('Cookie', adminA)
      .send({
        estabelecimentoId: base.estabelecimentoId,
        data: '2026-06-15',
        operacaoId: base.operacaoId,
        tpNf: '1',
        finNfe: '1',
        cfopId: base.cfopId,
        abrangencia: 'INTERNA',
        tipoProduto: 'REVENDA',
        produtoId: base.produtoId,
        ncmId: base.ncmId,
        cest: '1708700',
        clienteId: base.clienteId,
      });
    expect(consulta.status).toBe(422);
    expect(chamadasEnquadramento()).toHaveLength(0);
  });

  it('duplicar emite um evento da cópia', async () => {
    const base = await baseAprovada();
    const origem = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base, { vigenciaFim: '2026-06-30' }));
    expect(origem.status).toBe(201);
    spy.mockClear();
    const copia = await request(app.getHttpServer())
      .post(`/fiscal/enquadramentos/${origem.body.id}/duplicar`)
      .set('Cookie', adminA)
      .send({ vigenciaInicio: '2026-07-01', versao: origem.body.versao, justificativa: MOTIVO });
    expect(copia.status).toBe(201);
    const eventos = chamadasEnquadramento();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.[1]).toEqual(expect.objectContaining({
      acao: 'duplicado',
      enquadramentoId: copia.body.id,
      estabelecimentoId: base.estabelecimentoId,
    }));
    expect((eventos[0]?.[1] as { enquadramentoId: string }).enquadramentoId).not.toBe(origem.body.id);
  });
});
