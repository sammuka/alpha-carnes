import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Regra inicial da vigência de 2026.';

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

function statusDe(respostas: { status: number }[]): number[] {
  return respostas.map((resposta) => resposta.status).sort((a, b) => a - b);
}

describe('E01-T03 concorrência', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let seq = 80;

  beforeAll(async () => {
    app = await createTestApp();
    const a = await createTestUser(app, { perfil: 'administrador' });
    adminA = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: a.adminEmail, password: a.adminPassword }));
    const emailB = `admin-b-cc-${Date.now()}@test.local`;
    const senhaB = 'TestPass@123456';
    const criado = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminA)
      .send({ nome: 'Admin B', email: emailB, password: senhaB, perfis: ['administrador'] });
    expect(criado.status).toBe(201);
    adminB = joinSetCookie(await request(app.getHttpServer()).post('/auth/login').send({ email: emailB, password: senhaB }));
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  function raiz(): string {
    seq += 1;
    return `81RC${String(seq).padStart(4, '0')}`;
  }

  function dataOp(): string {
    const dia = ((seq - 1) % 28) + 1;
    const mes = (Math.floor((seq - 1) / 28) % 12) + 1;
    return `2095-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
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
        documentoFiscal: cnpjNumerico(`6${String(seq).padStart(11, '0')}`),
        faixaPreco: 'A',
      });
    expect(cliente.status).toBe(201);
    const cfop = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', adminA)
      .send({ codigo: String(6100 + seq).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(cfop.status).toBe(201);
    const ncm = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', adminA)
      .send({ codigo: String(41000000 + seq).padStart(8, '0'), descricao: `NCM ${cnpjRaiz}`, justificativa: MOTIVO });
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
      .send({ codigo: `SP${String(300000 + seq).padStart(6, '0')}`, descricao: `Benefício ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(beneficio.status).toBe(201);
    const classificacao = await request(app.getHttpServer())
      .post('/fiscal/classificacoes-ibs-cbs')
      .set('Cookie', adminA)
      .send({ codigo: String(100000 + seq).padStart(6, '0'), descricao: `Classificação ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(classificacao.status).toBe(201);
    return {
      enquadramentoId: enquadramento.body.id as string,
      operacaoId: operacao.body.id as string,
      cfopId: cfop.body.id as string,
      beneficioFiscalId: beneficio.body.id as string,
      classificacaoIbsCbsId: classificacao.body.id as string,
    };
  }

  function corpoRegra(base: Awaited<ReturnType<typeof cenario>>, extra: Record<string, unknown> = {}) {
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
      vigenciaFim: '2026-12-31' as string | null,
      justificativa: MOTIVO,
      ...extra,
    };
  }

  it('2 PATCH do mesmo rascunho → [200,409]', async () => {
    const corpo = corpoRegra(await cenario());
    const criado = await request(app.getHttpServer()).post('/fiscal/regras').set('Cookie', adminA).send(corpo);
    expect(criado.status).toBe(201);
    const respostas = await Promise.all([
      request(app.getHttpServer()).patch(`/fiscal/regras/${criado.body.id}`).set('Cookie', adminA)
        .send({ ...corpo, pIcms: '8,00', versao: criado.body.versao }),
      request(app.getHttpServer()).patch(`/fiscal/regras/${criado.body.id}`).set('Cookie', adminA)
        .send({ ...corpo, pIcms: '9,00', versao: criado.body.versao }),
    ]);
    expect(statusDe(respostas)).toEqual([200, 409]);
    const conflito = respostas.find((resposta) => resposta.status === 409);
    expect(codigoDe(conflito?.body ?? {})).toBe('CONFLITO_CONCORRENTE');
  });

  it('2 aprovações sobrepostas → [200,422]', async () => {
    const base = await cenario();
    const primeira = await request(app.getHttpServer())
      .post('/fiscal/regras')
      .set('Cookie', adminA)
      .send(corpoRegra(base, { vigenciaInicio: '2026-01-01', vigenciaFim: '2026-12-31' }));
    const segunda = await request(app.getHttpServer())
      .post('/fiscal/regras')
      .set('Cookie', adminA)
      .send(corpoRegra(base, { vigenciaInicio: '2026-06-01', vigenciaFim: null }));
    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(201);
    const sub1 = await request(app.getHttpServer())
      .post(`/fiscal/regras/${primeira.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: primeira.body.versao, justificativa: MOTIVO });
    const sub2 = await request(app.getHttpServer())
      .post(`/fiscal/regras/${segunda.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: segunda.body.versao, justificativa: MOTIVO });
    expect(sub1.status).toBe(200);
    expect(sub2.status).toBe(200);
    const respostas = await Promise.all([
      request(app.getHttpServer()).post(`/fiscal/regras/${primeira.body.id}/aprovar`).set('Cookie', adminB)
        .send({ versao: sub1.body.versao, justificativa: MOTIVO }),
      request(app.getHttpServer()).post(`/fiscal/regras/${segunda.body.id}/aprovar`).set('Cookie', adminB)
        .send({ versao: sub2.body.versao, justificativa: MOTIVO }),
    ]);
    expect(statusDe(respostas)).toEqual([200, 422]);
    const ambigua = respostas.find((resposta) => resposta.status === 422);
    expect(codigoDe(ambigua?.body ?? {})).toBe('VIGENCIA_AMBIGUA');
  });
});
