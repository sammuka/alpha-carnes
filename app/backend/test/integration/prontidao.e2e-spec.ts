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
    const texto = JSON.stringify(res.body);
    expect(texto).toContain('DP-01');
    expect(texto).toContain('clientes');
  });

  it('passa a reportar pronto somente quando TODAS as entidades obrigatórias têm registro ativo', async () => {
    await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send({ codigo: 'CLI-DP01', razaoSocial: 'Cliente DP01', documentoFiscal: CNPJ_A });
    await request(app.getHttpServer())
      .post('/fornecedores')
      .set('Cookie', adminCookies)
      .send({ codigo: 'FOR-DP01', razaoSocial: 'Fornecedor DP01', documentoFiscal: CNPJ_B });
    const produtoCompra = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminCookies)
      .send({
        codigo: 'IC-DP01',
        nome: 'Boi',
        unidadePedido: 'unidade',
        tipoOperacional: 'compra_base',
        ativoCompra: true,
        ativoVenda: false,
      });
    const produtoVenda = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminCookies)
      .send({
        codigo: 'ICM-DP01',
        nome: 'Dianteiro',
        unidadePedido: 'kg',
        ativoCompra: true,
        ativoVenda: true,
      });

    const semRegra = await request(app.getHttpServer()).get('/cadastros/prontidao').set('Cookie', adminCookies);
    expect(semRegra.status).toBe(409);
    expect(JSON.stringify(semRegra.body)).toContain('regrasDesdobramento');

    await request(app.getHttpServer())
      .post('/regras-desdobramento')
      .set('Cookie', adminCookies)
      .send({
        produtoOrigemId: produtoCompra.body.id,
        produtoDestinoId: produtoVenda.body.id,
        fatorQuantidade: 1,
        vigenciaInicio: '2026-01-01T00:00:00.000Z',
      });

    const pronto = await request(app.getHttpServer()).get('/cadastros/prontidao').set('Cookie', adminCookies);
    expect(pronto.status).toBe(200);
    expect(pronto.body.pronto).toBe(true);
  });
});
