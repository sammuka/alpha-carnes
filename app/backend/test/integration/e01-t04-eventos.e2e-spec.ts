import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Regra inicial da vigência de 2026.';
const MOTIVO_SIM = 'Motivo da alteração desta simulação.';

function codigoDe(body: { codigo?: string; message?: { codigo?: string } | string }): string | undefined {
  if (typeof body.codigo === 'string') return body.codigo;
  return typeof body.message === 'object' ? body.message.codigo : undefined;
}

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

describe('E01-T04 eventos da simulação', () => {
  let app: INestApplication;
  let admin = '';
  let adminB = '';
  let gestor = '';
  let gestorEmail = '';
  let gestorSenha = '';
  let seq = 400;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let spy: jest.SpiedFunction<EventEmitter2['emit']>;

  beforeAll(async () => {
    app = await createTestApp();
    await app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db.execute(sql`
      DELETE FROM perfis_permissoes
      WHERE perfil_id = (SELECT id FROM perfis WHERE slug = 'gestor')
        AND permissao_id IN (
          SELECT id FROM permissoes
          WHERE codigo IN ('FISCAL_SIMULACOES_LER', 'FISCAL_SIMULACOES_GERENCIAR')
        )
    `);
    const a = await createTestUser(app, { perfil: 'administrador' });
    const g = await createTestUser(app, { perfil: 'gestor' });
    gestorEmail = g.adminEmail;
    gestorSenha = g.adminPassword;
    admin = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    gestor = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: gestorEmail, password: gestorSenha }));
    const emailB = `admin-b-sim-${Date.now()}@test.local`;
    const senhaB = 'TestPass@123456';
    const criado = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', admin)
      .send({ nome: 'Admin B', email: emailB, password: senhaB, perfis: ['administrador'] });
    expect(criado.status).toBe(201);
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: emailB, password: senhaB }));
    fetchSpy = jest.spyOn(global, 'fetch');
    spy = jest.spyOn(app.get(EventEmitter2), 'emit');
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    await cleanupDb(app);
    await app.close();
  });

  function db() {
    return app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
  }

  function raiz(): string {
    seq += 1;
    return `74EV${String(seq).padStart(4, '0')}`;
  }

  function dataOp(): string {
    const dia = ((seq - 1) % 28) + 1;
    const mes = (Math.floor((seq - 1) / 28) % 12) + 1;
    return `2095-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  async function cenario(vigencia: { inicio?: string; fim?: string | null } = {}) {
    const cnpjRaiz = raiz();
    const empresa = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', admin)
      .send({ razaoSocial: `Empresa ${cnpjRaiz}`, cnpjRaiz, justificativa: MOTIVO });
    expect(empresa.status).toBe(201);
    const estab = await request(app.getHttpServer())
      .post('/fiscal/estabelecimentos')
      .set('Cookie', admin)
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
      .set('Cookie', admin)
      .send({ versao: estab.body.versao, justificativa: MOTIVO });
    expect(submetido.status).toBe(200);
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    const operacao = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', admin)
      .send({ data: dataOp(), rotulo: `Compra ${cnpjRaiz}` });
    expect(operacao.status).toBe(201);
    const produto = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', admin)
      .send({ codigo: `P-${cnpjRaiz}`, nome: 'Acém', unidadePedido: 'kg', atributosJson: { fiscal: { ncm: '99999999', cfop: '9999' } } });
    expect(produto.status).toBe(201);
    const cliente = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', admin)
      .send({
        codigo: `C-${cnpjRaiz}`,
        razaoSocial: 'Açougue Central LTDA',
        nomeFantasia: 'Açougue Central',
        documentoFiscal: cnpjNumerico(`8${String(seq).padStart(11, '0')}`),
        faixaPreco: 'A',
      });
    expect(cliente.status).toBe(201);
    const cfop = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', admin)
      .send({ codigo: String(5600 + (seq % 40)).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(cfop.status).toBe(201);
    const ncm = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', admin)
      .send({ codigo: String(4000000 + seq).padStart(8, '0'), descricao: `NCM ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(ncm.status).toBe(201);
    const enquadramento = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', admin)
      .send({
        estabelecimentoId: aprovado.body.id,
        operacaoId: operacao.body.id,
        tpNf: '1',
        finNfe: '1',
        cfopId: cfop.body.id,
        abrangencia: 'INTERNA',
        tipoProduto: 'REVENDA',
        produtoId: produto.body.id,
        ncmId: ncm.body.id,
        cest: '1708700',
        clienteId: cliente.body.id,
        vigenciaInicio: vigencia.inicio ?? '2026-01-01',
        vigenciaFim: vigencia.fim === undefined ? '2026-12-31' : vigencia.fim,
        prioridade: 1,
        justificativa: MOTIVO,
      });
    expect(enquadramento.status).toBe(201);
    const beneficio = await request(app.getHttpServer())
      .post('/fiscal/beneficios-fiscais')
      .set('Cookie', admin)
      .send({ codigo: `SP${String(300000 + seq).padStart(6, '0')}`, descricao: `Benefício ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(beneficio.status).toBe(201);
    const classificacao = await request(app.getHttpServer())
      .post('/fiscal/classificacoes-ibs-cbs')
      .set('Cookie', admin)
      .send({ codigo: String(100000 + seq).padStart(6, '0'), descricao: `Classificação ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(classificacao.status).toBe(201);
    return {
      empresaId: empresa.body.id as string,
      estabelecimentoId: aprovado.body.id as string,
      operacaoId: operacao.body.id as string,
      clienteId: cliente.body.id as string,
      produtoId: produto.body.id as string,
      ncmId: ncm.body.id as string,
      cfopId: cfop.body.id as string,
      enquadramentoId: enquadramento.body.id as string,
      beneficioFiscalId: beneficio.body.id as string,
      classificacaoIbsCbsId: classificacao.body.id as string,
    };
  }

  async function aprovarRegra(base: Awaited<ReturnType<typeof cenario>>, extra: Record<string, unknown> = {}) {
    const criada = await request(app.getHttpServer())
      .post('/fiscal/regras')
      .set('Cookie', admin)
      .send({
        enquadramentoId: base.enquadramentoId,
        operacaoId: base.operacaoId,
        cfopId: base.cfopId,
        icmsCst: '20',
        pRedBc: '41,67',
        pIcms: '12,00',
        beneficioFiscalId: base.beneficioFiscalId,
        ipiCst: '53',
        pisCst: '06',
        ibsCst: '000',
        classificacaoIbsCbsId: base.classificacaoIbsCbsId,
        vigenciaInicio: '2026-01-01',
        vigenciaFim: '2026-12-31',
        justificativa: MOTIVO,
        ...extra,
      });
    expect(criada.status).toBe(201);
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.body.id}/submeter`)
      .set('Cookie', admin)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    expect(submetida.status).toBe(200);
    const aprovada = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(aprovada.status).toBe(200);
    return { regraId: criada.body.id as string, base };
  }

  function corpoDe(base: Awaited<ReturnType<typeof cenario>>, extra: Record<string, unknown> = {}) {
    return {
      estabelecimentoId: base.estabelecimentoId,
      operacaoId: base.operacaoId,
      clienteId: base.clienteId,
      produtoId: base.produtoId,
      ncmId: base.ncmId,
      quantidade: '10,000',
      pesoNf: '982,000',
      valor: '1.000,00',
      desconto: '0,00',
      competencia: '2026-10',
      enquadramentoId: base.enquadramentoId,
      justificativa: MOTIVO_SIM,
      ...extra,
    };
  }

  function simular(cookies: string, corpo: Record<string, unknown>) {
    return request(app.getHttpServer()).post('/fiscal/simulacoes').set('Cookie', cookies).send(corpo);
  }

  function comparar(id: string, com: string) {
    return request(app.getHttpServer()).get(`/fiscal/simulacoes/${id}/comparar`).query({ com }).set('Cookie', admin);
  }

  function explicar(cookies: string, id: string) {
    return request(app.getHttpServer()).get(`/fiscal/simulacoes/${id}/explicacao`).set('Cookie', cookies);
  }

  async function contarNotas() {
    const notas = await db().execute(sql`SELECT COUNT(*)::int AS n FROM notas_fiscais`);
    const fornecedor = await db().execute(sql`SELECT COUNT(*)::int AS n FROM notas_fiscais_fornecedor`);
    return {
      notas: Number((notas.rows[0] as { n: number }).n),
      fornecedor: Number((fornecedor.rows[0] as { n: number }).n),
    };
  }

  async function limparSimulacoes() {
    await db().execute(sql`DELETE FROM simulacoes_fiscais`);
  }


  function chamadas() {
    return spy.mock.calls.filter((chamada) => chamada[0] === 'simulacao_fiscal_alterada');
  }

  it('1 evento depois do commit com acao simulada', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const visivel = new Promise<boolean>((resolve) => {
      app.get(EventEmitter2).once('simulacao_fiscal_alterada', (payload: { simulacaoId?: string; acao?: string }) => {
        void db()
          .select({ situacao: schema.simulacoesFiscais.situacao })
          .from(schema.simulacoesFiscais)
          .where(eq(schema.simulacoesFiscais.id, payload.simulacaoId ?? ''))
          .then((linhas) => resolve(payload.acao === 'simulada' && linhas[0]?.situacao === 'CALCULADA'));
      });
    });
    spy.mockClear();
    const res = await simular(admin, corpoDe(aprovada.base));
    expect(res.status).toBe(201);
    expect(chamadas()).toHaveLength(1);
    const payload = chamadas()[0]?.[1] as Record<string, unknown>;
    expect(payload).toEqual({
      simulacaoId: res.body.id,
      codigo: res.body.codigo,
      numeroVersao: res.body.numeroVersao,
      acao: 'simulada',
    });
    expect(payload).not.toHaveProperty('valor');
    expect(payload).not.toHaveProperty('baseTributavel');
    expect(payload).not.toHaveProperty('icms');
    expect(payload).not.toHaveProperty('notaId');
    expect(await visivel).toBe(true);
  });

  it('422 FALTA_REFERENCIA_LEGAL não emite', async () => {
    const aprovada = await aprovarRegra(await cenario({ fim: '2027-12-31' }));
    spy.mockClear();
    const res = await simular(admin, corpoDe(aprovada.base, { competencia: '2027-01' }));
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('FALTA_REFERENCIA_LEGAL');
    expect(chamadas()).toHaveLength(0);
  });
})
