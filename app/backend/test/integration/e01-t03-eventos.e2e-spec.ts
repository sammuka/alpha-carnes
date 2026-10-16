import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Regra inicial da vigência de 2026.';
const EVENTO = 'regra_tributaria_alterada';

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

describe('E01-T03 eventos pós-commit', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let seq = 120;
  let spy: jest.SpiedFunction<EventEmitter2['emit']>;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    adminA = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    const emailB = `admin-b-ev-${Date.now()}@test.local`;
    const senhaB = 'TestPass@123456';
    const criado = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminA)
      .send({ nome: 'Admin B', email: emailB, password: senhaB, perfis: ['administrador'] });
    expect(criado.status).toBe(201);
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: emailB, password: senhaB }));
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

  function chamadasRegra() {
    return spy.mock.calls.filter((chamada) => chamada[0] === EVENTO);
  }

  function raiz(): string {
    seq += 1;
    return `81RE${String(seq).padStart(4, '0')}`;
  }

  function dataOp(): string {
    const dia = ((seq - 1) % 28) + 1;
    const mes = (Math.floor((seq - 1) / 28) % 12) + 1;
    return `2094-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  async function cenario() {
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
    expect(submetido.status).toBe(200);
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    const operacao = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', adminA)
      .send({ data: dataOp(), rotulo: `Compra ${cnpjRaiz}` });
    expect(operacao.status).toBe(201);
    const produto = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminA)
      .send({ codigo: `P-${cnpjRaiz}`, nome: 'Acém', unidadePedido: 'kg', atributosJson: { fiscal: { ncm: '99999999', cfop: '9999' } } });
    expect(produto.status).toBe(201);
    const cliente = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminA)
      .send({
        codigo: `C-${cnpjRaiz}`,
        razaoSocial: 'Açougue Central LTDA',
        nomeFantasia: 'Açougue Central',
        documentoFiscal: cnpjNumerico(`5${String(seq).padStart(11, '0')}`),
        faixaPreco: 'A',
      });
    expect(cliente.status).toBe(201);
    const cfop = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', adminA)
      .send({ codigo: String(6200 + seq).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(cfop.status).toBe(201);
    const ncm = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', adminA)
      .send({ codigo: String(42000000 + seq).padStart(8, '0'), descricao: `NCM ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(ncm.status).toBe(201);
    const enquadramento = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
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
        vigenciaInicio: '2026-01-01',
        vigenciaFim: '2026-12-31',
        prioridade: 1,
        justificativa: MOTIVO,
      });
    expect(enquadramento.status).toBe(201);
    const beneficio = await request(app.getHttpServer())
      .post('/fiscal/beneficios-fiscais')
      .set('Cookie', adminA)
      .send({ codigo: `SP${String(400000 + seq).padStart(6, '0')}`, descricao: `Benefício ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(beneficio.status).toBe(201);
    const classificacao = await request(app.getHttpServer())
      .post('/fiscal/classificacoes-ibs-cbs')
      .set('Cookie', adminA)
      .send({ codigo: String(200000 + seq).padStart(6, '0'), descricao: `Classificação ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(classificacao.status).toBe(201);
    return {
      enquadramentoId: enquadramento.body.id as string,
      operacaoId: operacao.body.id as string,
      cfopId: cfop.body.id as string,
      beneficioFiscalId: beneficio.body.id as string,
      classificacaoIbsCbsId: classificacao.body.id as string,
    };
  }

  function corpoRegra(base: Awaited<ReturnType<typeof cenario>>) {
    return {
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
    };
  }

  it('1 evento depois do commit', async () => {
    const criada = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', adminA).send(corpoRegra(await cenario()));
    expect(criada.status).toBe(201);
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    expect(submetida.status).toBe(200);
    const visivel = new Promise<boolean>((resolve) => {
      app.get(EventEmitter2).once(EVENTO, (payload: { regraId?: string; acao?: string }) => {
        void db()
          .select({ situacao: schema.regrasTributarias.situacao })
          .from(schema.regrasTributarias)
          .where(eq(schema.regrasTributarias.id, payload.regraId ?? ''))
          .then((linhas) => resolve(payload.acao === 'aprovada' && linhas[0]?.situacao === 'APROVADA'));
      });
    });
    spy.mockClear();
    const aprovada = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(aprovada.status).toBe(200);
    const eventos = chamadasRegra();
    expect(eventos).toHaveLength(1);
    const payload = eventos[0]?.[1] as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({
      acao: 'aprovada',
      regraId: criada.body.id,
      enquadramentoId: criada.body.enquadramentoId,
      codigo: criada.body.codigo,
      numeroVersao: criada.body.numeroVersao,
      situacao: 'APROVADA',
    }));
    expect(payload).not.toHaveProperty('pIcms');
    expect(payload).not.toHaveProperty('icmsCst');
    expect(payload).not.toHaveProperty('notaId');
    expect(await visivel).toBe(true);
  });

  it('422 de segregação não emite', async () => {
    const criada = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', adminA).send(corpoRegra(await cenario()));
    expect(criada.status).toBe(201);
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    expect(submetida.status).toBe(200);
    spy.mockClear();
    const res = await request(app.getHttpServer())
      .post(`/fiscal/regras/${criada.body.id}/aprovar`)
      .set('Cookie', adminA)
      .send({ versao: submetida.body.versao, justificativa: MOTIVO });
    expect(res.status).toBe(422);
    expect(codigoDe(res.body)).toBe('SEGREGACAO_FUNCAO');
    expect(chamadasRegra()).toHaveLength(0);
  });

  it('M7: catálogo criado emite só código, ação e situação, sem regraId nem enquadramentoId', async () => {
    spy.mockClear();
    const beneficio = await request(app.getHttpServer()).post('/fiscal/beneficios-fiscais').set('Cookie', adminA)
      .send({ codigo: 'SP777001', descricao: 'Benefício evento', justificativa: MOTIVO });
    expect(beneficio.status).toBe(201);
    const classificacao = await request(app.getHttpServer()).post('/fiscal/classificacoes-ibs-cbs').set('Cookie', adminA)
      .send({ codigo: '777001', descricao: 'Classificação evento', justificativa: MOTIVO });
    expect(classificacao.status).toBe(201);
    const payloads = chamadasRegra().map((chamada) => chamada[1]);
    expect(payloads).toEqual([
      { codigo: 'SP777001', acao: 'beneficio_criado', situacao: 'ATIVA' },
      { codigo: '777001', acao: 'classificacao_criada', situacao: 'ATIVA' },
    ]);
  });
});
