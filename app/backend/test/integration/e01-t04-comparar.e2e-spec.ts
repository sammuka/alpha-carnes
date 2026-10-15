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

describe('E01-T04 comparação de simulações', () => {
  let app: INestApplication;
  let admin = '';
  let adminB = '';
  let gestor = '';
  let gestorEmail = '';
  let gestorSenha = '';
  let seq = 200;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

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
    return `72CP${String(seq).padStart(4, '0')}`;
  }

  function dataOp(): string {
    const dia = ((seq - 1) % 28) + 1;
    const mes = (Math.floor((seq - 1) / 28) % 12) + 1;
    return `2097-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
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
      .send({ codigo: String(5400 + (seq % 50)).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
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

  it('mesmo código lista ICMS', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const versao1 = await simular(admin, corpoDe(aprovada.base));
    expect(versao1.status).toBe(201);
    const versao2 = await request(app.getHttpServer())
      .post(`/fiscal/simulacoes/${versao1.body.id}/versoes`)
      .set('Cookie', admin)
      .send({ ...corpoDe(aprovada.base), desconto: '100,00', versao: versao1.body.versao });
    expect(versao2.status).toBe(201);
    const res = await comparar(versao1.body.id, versao2.body.id);
    expect(res.status).toBe(200);
    const icms = res.body.diferencas.find((d: { campo: string }) => d.campo === 'ICMS');
    expect(icms).toMatchObject({ antes: '70,00', depois: '63,00' });
    expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('códigos distintos → 422 SIMULACOES_DISTINTAS', async () => {
    const linhaA = await simular(admin, corpoDe((await aprovarRegra(await cenario())).base));
    const linhaB = await simular(admin, corpoDe((await aprovarRegra(await cenario())).base));
    expect(linhaA.status).toBe(201);
    expect(linhaB.status).toBe(201);
    const res = await comparar(linhaA.body.id, linhaB.body.id);
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('SIMULACOES_DISTINTAS');
  });

  it('comparar não grava auditoria nem emite evento', async () => {
    const aprovada = await aprovarRegra(await cenario());
    const versao1 = await simular(admin, corpoDe(aprovada.base));
    const versao2 = await request(app.getHttpServer())
      .post(`/fiscal/simulacoes/${versao1.body.id}/versoes`)
      .set('Cookie', admin)
      .send({ ...corpoDe(aprovada.base), desconto: '100,00', versao: versao1.body.versao });
    expect(versao1.status).toBe(201);
    expect(versao2.status).toBe(201);
    const antes = await db().execute(sql`SELECT COUNT(*)::int AS n FROM auditoria WHERE tabela = 'simulacoes_fiscais'`);
    const emitidos = jest.spyOn(app.get(EventEmitter2), 'emit');
    emitidos.mockClear();
    const res = await comparar(versao1.body.id, versao2.body.id);
    expect(res.status).toBe(200);
    const depois = await db().execute(sql`SELECT COUNT(*)::int AS n FROM auditoria WHERE tabela = 'simulacoes_fiscais'`);
    expect(depois.rows[0]).toEqual(antes.rows[0]);
    expect(emitidos.mock.calls.filter((chamada) => chamada[0] === 'simulacao_fiscal_alterada')).toHaveLength(0);
    emitidos.mockRestore();
  });
})

