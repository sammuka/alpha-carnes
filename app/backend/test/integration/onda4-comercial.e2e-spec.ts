import { INestApplication } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import {
  cleanupDb,
  createTestApp,
  createTestUser,
  loginCookies,
} from '../helpers/test-app';
import {
  criarCompraConfirmada,
  seedComercialBase,
} from '../helpers/comercial-fixtures';

type Db = NodePgDatabase<typeof schema>;

interface TabelaPreco {
  id: string;
  status: string;
  itens: Array<{ produtoId: string }>;
}

interface MapaProduto {
  produtoId: string;
  estados: Record<string, string>;
}

interface EspelhoComercial {
  grupos: Array<{
    itens: Array<{ pedidoVendaId: string; status: string }>;
  }>;
}

describe('jornada integrada do comercial — Onda 4', () => {
  let app: INestApplication;
  let db: Db;
  let adminCookies: string;

  async function request() {
    return (await import('supertest')).default;
  }

  beforeAll(async () => {
    app = await createTestApp({
      HARDWARE_FAKE: 'true',
      NFSE_FAKE: 'true',
    });
    ({ db } = app.get(DRIZZLE));

    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    await seedCatalogoMvp(db);
  }, 60_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('percorre pedido, AD-03, adendo, liberação, preços, mapa e espelho', async () => {
    const req = await request();
    const dataOperacao = '2027-01-15';
    const base = await seedComercialBase(app, { fator: 1 });
    const compraProgramadaId = await criarCompraConfirmada(
      app,
      adminCookies,
      base,
      { dataOperacao, quantidade: 10 },
    );
    const pedidoBody = {
      compraProgramadaId,
      clienteId: base.clienteId,
      dataOperacao,
      salvarComoRascunho: true,
      itens: [{ produtoId: base.produtoCompraId,
        quantidadePedida: 8,
      }],
    };

    const criado = await req(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', adminCookies)
      .send(pedidoBody);
    expect(criado.status).toBe(201);
    expect(criado.body).toMatchObject({
      id: expect.any(String),
      operacaoId: expect.any(String),
      status: 'rascunho',
    });

    const duplicado = await req(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', adminCookies)
      .send(pedidoBody);
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.message.code).toBe('PEDIDO_ABERTO_EXISTENTE');

    const adendoBody = {
      produtoId: base.produtoId,
      quantidadeAdicionada: 5,
      motivo: 'Cliente solicitou cinco unidades adicionais',
    };
    const adendoComDeficit = await req(app.getHttpServer())
      .post(`/comercial/pedidos/${criado.body.id}/adendos`)
      .set('Cookie', adminCookies)
      .send(adendoBody);
    expect(adendoComDeficit.status).toBe(409);

    const adendoConfirmado = await req(app.getHttpServer())
      .post(`/comercial/pedidos/${criado.body.id}/adendos/confirmar-overbooking`)
      .set('Cookie', adminCookies)
      .send(adendoBody);
    expect(adendoConfirmado.status).toBe(201);
    expect(adendoConfirmado.body.item).toMatchObject({
      quantidadePedida: '13.000',
      quantidadeOverbooking: '3.000',
    });

    const liberado = await req(app.getHttpServer())
      .post(`/comercial/pedidos/${criado.body.id}/liberar-reserva`)
      .set('Cookie', adminCookies)
      .send({ justificativa: 'Cliente desistiu do pedido após a confirmação' });
    expect(liberado.status).toBe(200);
    expect(liberado.body.status).toBe('cancelado');

    const tabelaCriada = await req(app.getHttpServer())
      .post('/precos/tabelas')
      .set('Cookie', adminCookies)
      .send({ data: dataOperacao });
    expect(tabelaCriada.status).toBe(201);
    const tabela = tabelaCriada.body as TabelaPreco;
    expect(tabela.itens.length).toBeGreaterThan(0);

    const tabelaPreenchida = await req(app.getHttpServer())
      .patch(`/precos/tabelas/${tabela.id}/itens`)
      .set('Cookie', adminCookies)
      .send({
        itens: tabela.itens.map(({ produtoId }, index) => ({
          produtoId,
          precoA: 20 + index,
          precoB: 21 + index,
          precoC: 22 + index,
          precoD: 23 + index,
        })),
      });
    expect(tabelaPreenchida.status).toBe(200);

    const tabelaPublicada = await req(app.getHttpServer())
      .post(`/precos/tabelas/${tabela.id}/publicar`)
      .set('Cookie', adminCookies)
      .send({});
    expect(tabelaPublicada.status).toBe(200);
    expect(tabelaPublicada.body.status).toBe('publicada');

    const mapa = await req(app.getHttpServer())
      .get('/comercial/disponibilidade/mapa')
      .query({ operacaoId: criado.body.operacaoId })
      .set('Cookie', adminCookies);
    expect(mapa.status).toBe(200);
    const produtoNoMapa = (mapa.body as MapaProduto[])
      .find((item) => item.produtoId === base.produtoId);
    expect(produtoNoMapa).toBeDefined();
    expect(produtoNoMapa?.estados.V).toBe('10.000');
    expect(produtoNoMapa?.estados.R).toBe('0.000');
    expect(produtoNoMapa?.estados.O).toBe('0.000');

    const espelho = await req(app.getHttpServer())
      .get('/comercial/espelho')
      .query({ dataOperacao, agrupar: 'cliente' })
      .set('Cookie', adminCookies);
    expect(espelho.status).toBe(200);
    const itensEspelho = (espelho.body as EspelhoComercial).grupos
      .flatMap((grupo) => grupo.itens);
    expect(itensEspelho).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pedidoVendaId: criado.body.id,
        status: 'Cancelado',
      }),
    ]));
  }, 60_000);
});
