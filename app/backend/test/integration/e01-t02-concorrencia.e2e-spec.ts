import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
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

function statusDe(respostas: { status: number }[]): number[] {
  return respostas.map((resposta) => resposta.status).sort((a, b) => a - b);
}

describe('E01-T02 concorrência', () => {
  let app: INestApplication;
  let adminA = '';
  let adminB = '';
  let seq = 0;

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

  function raiz(): string {
    seq += 1;
    return `81CC${String(seq).padStart(4, '0')}`;
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
    expect(submetido.status).toBe(200);
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${estab.body.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    const operacao = await request(app.getHttpServer())
      .post('/operacoes/extraordinaria')
      .set('Cookie', adminA)
      .send({ data: `2098-01-${String(seq).padStart(2, '0')}`, rotulo: `Compra ${cnpjRaiz}` });
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
        documentoFiscal: cnpjNumerico(`8${String(seq).padStart(11, '0')}`),
        faixaPreco: 'A',
      });
    expect(cliente.status).toBe(201);
    const cfop = await request(app.getHttpServer())
      .post('/fiscal/cfops')
      .set('Cookie', adminA)
      .send({ codigo: String(7000 + seq).padStart(4, '0'), descricao: `CFOP ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(cfop.status).toBe(201);
    const ncm = await request(app.getHttpServer())
      .post('/fiscal/ncms')
      .set('Cookie', adminA)
      .send({ codigo: String(30000000 + seq).padStart(8, '0'), descricao: `NCM ${cnpjRaiz}`, justificativa: MOTIVO });
    expect(ncm.status).toBe(201);
    return {
      estabelecimentoId: aprovado.body.id as string,
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

  it('2 POST mesma chave → [201,409]', async () => {
    const base = await baseAprovada();
    const respostas = await Promise.all([
      request(app.getHttpServer()).post('/fiscal/enquadramentos').set('Cookie', adminA).send(corpo(base, { prioridade: 1 })),
      request(app.getHttpServer()).post('/fiscal/enquadramentos').set('Cookie', adminA).send(corpo(base, { prioridade: 9 })),
    ]);
    expect(statusDe(respostas)).toEqual([201, 409]);
  });

  it('2 PATCH mesma versao → [200,409]', async () => {
    const base = await baseAprovada();
    const criado = await request(app.getHttpServer())
      .post('/fiscal/enquadramentos')
      .set('Cookie', adminA)
      .send(corpo(base));
    expect(criado.status).toBe(201);
    const { estabelecimentoId: _estab, ...editavel } = corpo(base);
    const respostas = await Promise.all([
      request(app.getHttpServer()).patch(`/fiscal/enquadramentos/${criado.body.id}`).set('Cookie', adminA)
        .send({ ...editavel, prioridade: 2, versao: criado.body.versao }),
      request(app.getHttpServer()).patch(`/fiscal/enquadramentos/${criado.body.id}`).set('Cookie', adminA)
        .send({ ...editavel, prioridade: 3, versao: criado.body.versao }),
    ]);
    expect(statusDe(respostas)).toEqual([200, 409]);
  });
});
