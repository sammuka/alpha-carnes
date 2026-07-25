import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { DRIZZLE } from '../../src/database/database.module';

type Campos = Record<string, boolean>;

/**
 * Transcrição literal da decisão 21 (ModelosEtiqueta.tsx linhas 33–69) — escrita à mão aqui de
 * propósito: o teste não importa o array do seed, senão compararia o seed consigo mesmo.
 */
const BASE: Campos = {
  codigo: true, produto: true, peso: true, clientePedido: false, destino: true,
  origemFrigorifico: true, nfLote: true, dataHora: true, operador: true,
  caracteristicas: false, qrCode: true, codigoBarras: false,
};

const ESPERADO: Record<string, { nome: string; campos: Campos }> = {
  'peca-pedido':     { nome: 'Peça para Pedido',    campos: { ...BASE, clientePedido: true, caracteristicas: true } },
  'peca-estoque':    { nome: 'Peça para Estoque',   campos: { ...BASE, clientePedido: false, destino: true } },
  'peca-desossa':    { nome: 'Peça para Desossa',   campos: { ...BASE, clientePedido: false, caracteristicas: true } },
  'parte-pedido':    { nome: 'Parte para Pedido',   campos: { ...BASE, clientePedido: true, caracteristicas: true, origemFrigorifico: true } },
  'parte-estoque':   { nome: 'Parte para Estoque',  campos: { ...BASE, clientePedido: false } },
  'produto-unidade': { nome: 'Produto por Unidade', campos: { ...BASE, peso: false, caracteristicas: false, qrCode: false, codigoBarras: true } },
};

const SLUGS = Object.keys(ESPERADO);

describe('Modelos de etiqueta e2e', () => {
  let app: INestApplication;
  let adminCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);

    // DoD-19 exige provar o SEED, não um POST do próprio teste (Task 2.1).
    const { seedModelosEtiqueta } = await import('../../src/database/seed');
    await seedModelosEtiqueta(app.get(DRIZZLE).db);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const srv = () => app.getHttpServer();

  it('seed cria os 6 modelos com os campos do prototipo', async () => {
    const lista = await request(srv()).get('/modelos-etiqueta?pageSize=50').set('Cookie', adminCookies);
    expect(lista.status).toBe(200);

    const porSlug = new Map(
      (lista.body.data as { slug: string; nome: string; campos: Campos }[]).map((m) => [m.slug, m]),
    );
    expect([...porSlug.keys()].sort()).toEqual([...SLUGS].sort());

    for (const slug of SLUGS) {
      const modelo = porSlug.get(slug);
      expect(modelo?.nome).toBe(ESPERADO[slug]!.nome);
      expect(modelo?.campos).toEqual(ESPERADO[slug]!.campos);
    }
  });

  it('atualiza campos e rejeita conjunto de chaves invalido', async () => {
    const lista = await request(srv()).get('/modelos-etiqueta').set('Cookie', adminCookies);
    const alvo = lista.body.data[0];

    const ok = await request(srv()).patch(`/modelos-etiqueta/${alvo.id}`).set('Cookie', adminCookies)
      .send({ campos: { ...alvo.campos, caracteristicas: true } });
    expect(ok.status).toBe(200);
    expect(ok.body.campos.caracteristicas).toBe(true);

    const faltando = await request(srv()).patch(`/modelos-etiqueta/${alvo.id}`).set('Cookie', adminCookies)
      .send({ campos: { codigo: true } });
    expect(faltando.status).toBe(400);

    const sobrando = await request(srv()).patch(`/modelos-etiqueta/${alvo.id}`).set('Cookie', adminCookies)
      .send({ campos: { ...alvo.campos, inventado: true } });
    expect(sobrando.status).toBe(400);
  });
});
