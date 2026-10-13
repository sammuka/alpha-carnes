import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { validarCnpjAlfanumerico } from '../../src/common/validators/cnpj-alfanumerico';
import { cleanupDb, createTestApp, createTestUser, joinSetCookie } from '../helpers/test-app';

const MOTIVO = 'Ajuste de cadastro fiscal';

function cnpjDe(base12: string): string {
  for (let i = 0; i < 100; i += 1) {
    const candidato = `${base12}${String(i).padStart(2, '0')}`;
    if (validarCnpjAlfanumerico(candidato)) return candidato;
  }
  throw new Error(`CNPJ sem DV para ${base12}`);
}

function statusDe(respostas: { status: number }[]): number[] {
  return respostas.map((resposta) => resposta.status).sort((a, b) => a - b);
}

describe('E01-T01 concorrência', () => {
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

  async function empresa(raiz: string) {
    const res = await request(app.getHttpServer())
      .post('/fiscal/empresas')
      .set('Cookie', adminA)
      .send({ razaoSocial: 'Alpha Carnes LTDA', cnpjRaiz: raiz, justificativa: MOTIVO });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function estab(empresaId: string, cnpj: string) {
    const res = await request(app.getHttpServer())
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
    expect(res.status).toBe(201);
    return res.body as { id: string; versao: number };
  }

  async function aprovar(raiz: string) {
    const criado = await estab(await empresa(raiz), cnpjDe(`${raiz}0001`));
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criado.versao, justificativa: MOTIVO });
    const aprovado = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.id}/aprovar`)
      .set('Cookie', adminB)
      .send({ versao: submetido.body.versao, justificativa: MOTIVO });
    expect(aprovado.status).toBe(200);
    return aprovado.body as { id: string; versao: number; nome: string };
  }

  it('2 POST mesmo CNPJ → [201,409]', async () => {
    const empresaId = await empresa('51ABC001');
    const cnpj = cnpjDe('51ABC0010001');
    const corpo = {
      empresaId,
      nome: 'Filial Osasco',
      cnpj,
      inscricaoEstadual: '123456789',
      inscricaoMunicipal: '98765',
      uf: 'SP',
      justificativa: MOTIVO,
    };
    const respostas = await Promise.all([
      request(app.getHttpServer()).post('/fiscal/estabelecimentos').set('Cookie', adminA).send(corpo),
      request(app.getHttpServer()).post('/fiscal/estabelecimentos').set('Cookie', adminA).send({ ...corpo, nome: 'Filial Barueri' }),
    ]);
    expect(statusDe(respostas)).toEqual([201, 409]);
  });

  it('2 PATCH mesma versao → [200,409]', async () => {
    const criado = await estab(await empresa('51ABC002'), cnpjDe('51ABC0020001'));
    const respostas = await Promise.all([
      request(app.getHttpServer()).patch(`/fiscal/estabelecimentos/${criado.id}`).set('Cookie', adminA)
        .send({ nome: 'Um', versao: criado.versao, justificativa: MOTIVO }),
      request(app.getHttpServer()).patch(`/fiscal/estabelecimentos/${criado.id}`).set('Cookie', adminA)
        .send({ nome: 'Dois', versao: criado.versao, justificativa: MOTIVO }),
    ]);
    expect(statusDe(respostas)).toEqual([200, 409]);
  });

  it('2 PUT cnaes mesma versao → [200,409]', async () => {
    const criado = await estab(await empresa('51ABC003'), cnpjDe('51ABC0030001'));
    const corpo = {
      cnaes: [{ codigo: '6202300', descricao: 'Outros', tipo: 'PRINCIPAL' }],
      versao: criado.versao,
      justificativa: MOTIVO,
    };
    const respostas = await Promise.all([
      request(app.getHttpServer()).put(`/fiscal/estabelecimentos/${criado.id}/cnaes`).set('Cookie', adminA).send(corpo),
      request(app.getHttpServer()).put(`/fiscal/estabelecimentos/${criado.id}/cnaes`).set('Cookie', adminA).send(corpo),
    ]);
    expect(statusDe(respostas)).toEqual([200, 409]);
  });

  it('2 POST alteracoes → [201,409]', async () => {
    const aprovado = await aprovar('51ABC004');
    const corpo = {
      nome: 'Filial Barueri',
      inscricaoEstadual: '555444333',
      inscricaoMunicipal: '111',
      uf: 'RJ',
      cnaes: [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }],
      versao: aprovado.versao,
      justificativa: MOTIVO,
    };
    const respostas = await Promise.all([
      request(app.getHttpServer()).post(`/fiscal/estabelecimentos/${aprovado.id}/alteracoes`).set('Cookie', adminA).send(corpo),
      request(app.getHttpServer()).post(`/fiscal/estabelecimentos/${aprovado.id}/alteracoes`).set('Cookie', adminA).send({ ...corpo, nome: 'Outra' }),
    ]);
    expect(statusDe(respostas)).toEqual([201, 409]);
  });

  it('2 submissões sobrepostas → [200,409]', async () => {
    const criado = await estab(await empresa('51ABC005'), cnpjDe('51ABC0050001'));
    const corpo = { versao: criado.versao, justificativa: MOTIVO };
    const respostas = await Promise.all([
      request(app.getHttpServer()).post(`/fiscal/estabelecimentos/${criado.id}/submeter`).set('Cookie', adminA).send(corpo),
      request(app.getHttpServer()).post(`/fiscal/estabelecimentos/${criado.id}/submeter`).set('Cookie', adminA).send(corpo),
    ]);
    expect(statusDe(respostas)).toEqual([200, 409]);
  });

  it('2 aprovações sobrepostas → 1 APPROVED', async () => {
    const criado = await estab(await empresa('51ABC006'), cnpjDe('51ABC0060001'));
    const submetido = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${criado.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criado.versao, justificativa: MOTIVO });
    const corpo = { versao: submetido.body.versao, justificativa: MOTIVO };
    const respostas = await Promise.all([
      request(app.getHttpServer()).post(`/fiscal/estabelecimentos/${criado.id}/aprovar`).set('Cookie', adminB).send(corpo),
      request(app.getHttpServer()).post(`/fiscal/estabelecimentos/${criado.id}/aprovar`).set('Cookie', adminB).send(corpo),
    ]);
    expect(statusDe(respostas)).toEqual([200, 409]);
    const ficha = await request(app.getHttpServer()).get(`/fiscal/estabelecimentos/${criado.id}`).set('Cookie', adminA);
    expect(ficha.body.situacao).toBe('APPROVED');
  });

  it('aprovar alteração × suspender → um vence, outro 409', async () => {
    const aprovado = await aprovar('51ABC007');
    const criada = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${aprovado.id}/alteracoes`)
      .set('Cookie', adminA)
      .send({
        nome: 'Filial Barueri',
        inscricaoEstadual: '555444333',
        inscricaoMunicipal: '111',
        uf: 'RJ',
        cnaes: [{ codigo: '6201501', descricao: 'Desenvolvimento', tipo: 'PRINCIPAL' }],
        versao: aprovado.versao,
        justificativa: MOTIVO,
      });
    const submetida = await request(app.getHttpServer())
      .post(`/fiscal/estabelecimentos/${aprovado.id}/alteracoes/${criada.body.id}/submeter`)
      .set('Cookie', adminA)
      .send({ versao: criada.body.versao, justificativa: MOTIVO });
    const [decisao, suspensao] = await Promise.all([
      request(app.getHttpServer())
        .post(`/fiscal/estabelecimentos/${aprovado.id}/alteracoes/${criada.body.id}/aprovar`)
        .set('Cookie', adminB)
        .send({ versao: submetida.body.versao, justificativa: MOTIVO }),
      request(app.getHttpServer())
        .post(`/fiscal/estabelecimentos/${aprovado.id}/suspender`)
        .set('Cookie', adminB)
        .send({ versao: aprovado.versao, justificativa: MOTIVO }),
    ]);
    expect(statusDe([decisao, suspensao])).toEqual([200, 409]);
    const ficha = await request(app.getHttpServer()).get(`/fiscal/estabelecimentos/${aprovado.id}`).set('Cookie', adminA);
    if (decisao.status === 200) {
      expect(ficha.body.situacao).toBe('APPROVED');
      expect(ficha.body.nome).toBe('Filial Barueri');
    } else {
      expect(suspensao.status).toBe(200);
      expect(ficha.body.situacao).toBe('SUSPENDED');
      expect(ficha.body.nome).toBe('Filial Osasco');
    }
  });
});
