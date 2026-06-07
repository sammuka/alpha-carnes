import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

const CNPJ_A = '11222333000181';
const CNPJ_B = '04252011000110';

describe('DP-01 — Prontidão de cadastros e2e', () => {
  let app: INestApplication;
  let adminCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('falha de forma explícita (409) quando faltam cadastros mínimos', async () => {
    const res = await request(app.getHttpServer()).get('/cadastros/prontidao').set('Cookie', adminCookies);
    expect(res.status).toBe(409);
    // O filtro global aninha a mensagem em message.message; valida via texto do corpo (RA-05).
    const texto = JSON.stringify(res.body);
    expect(texto).toContain('DP-01');
    expect(texto).toContain('clientes');
  });

  it('passa a reportar pronto somente quando TODAS as entidades obrigatórias têm registro ativo', async () => {
    // Cria cliente + fornecedor + item de compra + item comercial.
    await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send({ codigo: 'CLI-DP01', razaoSocial: 'Cliente DP01', documentoFiscal: CNPJ_A });
    await request(app.getHttpServer())
      .post('/fornecedores')
      .set('Cookie', adminCookies)
      .send({ codigo: 'FOR-DP01', razaoSocial: 'Fornecedor DP01', documentoFiscal: CNPJ_B });
    const ic = await request(app.getHttpServer())
      .post('/itens-compra')
      .set('Cookie', adminCookies)
      .send({ codigo: 'IC-DP01', descricao: 'Boi', unidadeCompra: 'cabeca' });
    const icm = await request(app.getHttpServer())
      .post('/itens-comerciais')
      .set('Cookie', adminCookies)
      .send({ codigo: 'ICM-DP01', descricao: 'Dianteiro', unidadeComercial: 'peca' });

    // Sem a regra de desdobramento, ainda deve falhar (apenas regrasDesdobramento faltando).
    const semRegra = await request(app.getHttpServer()).get('/cadastros/prontidao').set('Cookie', adminCookies);
    expect(semRegra.status).toBe(409);
    expect(JSON.stringify(semRegra.body)).toContain('regrasDesdobramento');

    // Cria a regra ativa que faltava.
    await request(app.getHttpServer())
      .post('/regras-desdobramento')
      .set('Cookie', adminCookies)
      .send({
        itemCompraId: ic.body.id,
        itemComercialId: icm.body.id,
        fatorQuantidade: 1,
        vigenciaInicio: '2026-01-01T00:00:00.000Z',
      });

    const pronto = await request(app.getHttpServer()).get('/cadastros/prontidao').set('Cookie', adminCookies);
    expect(pronto.status).toBe(200);
    expect(pronto.body.pronto).toBe(true);
  });
});
