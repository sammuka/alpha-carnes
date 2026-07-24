import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { seedComercialBase } from '../helpers/comercial-fixtures';

describe('operacoes-writers e2e', () => {
  let app: INestApplication;
  let comprasCookies: string;
  let comercialCookies: string;
  let expedicaoCookies: string;
  let recebimentoCookies: string;
  let faturamentoCookies: string;
  let base: Awaited<ReturnType<typeof seedComercialBase>>;
  let diaSeq = 0;

  beforeAll(async () => {
    app = await createTestApp();
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const expedicao = await createTestUser(app, { perfil: 'expedicao' });
    const recebimento = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    const faturamento = await createTestUser(app, { perfil: 'faturamento' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    expedicaoCookies = await loginCookies(app, expedicao.adminEmail, expedicao.adminPassword);
    recebimentoCookies = await loginCookies(app, recebimento.adminEmail, recebimento.adminPassword);
    faturamentoCookies = await loginCookies(app, faturamento.adminEmail, faturamento.adminPassword);
    base = await seedComercialBase(app, { fator: 2 });
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  function proximaData(): string {
    diaSeq += 1;
    return `2026-09-${String(diaSeq).padStart(2, '0')}`;
  }

  async function contarSemOperacao(tabela: string): Promise<number> {
    const { db } = app.get(DRIZZLE) as { db: import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema> };
    const result = await db.execute<{ total: number }>(
      sql.raw(`SELECT count(*)::int AS total FROM ${tabela} WHERE operacao_id IS NULL`),
    );
    return Number(result.rows[0]?.total ?? 0);
  }

  async function criarCompraConfirmada(data: string): Promise<string> {
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao: data,
        fornecedorId: base.fornecedorId,
        itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 5 }],
      });
    expect(criar.status).toBe(201);
    const conf = await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${criar.body.id}/confirmar`)
      .set('Cookie', comprasCookies);
    expect(conf.status).toBe(201);
    return criar.body.id as string;
  }

  async function executarFluxoPublico(tabela: string): Promise<void> {
    const data = proximaData();

    if (tabela === 'compras_programadas') {
      const criar = await request(app.getHttpServer())
        .post('/comercial/compras-programadas')
        .set('Cookie', comprasCookies)
        .send({
          dataOperacao: data,
          fornecedorId: base.fornecedorId,
          itens: [{ itemCompraId: base.itemCompraId, quantidadeComprada: 5 }],
        });
      expect(criar.status).toBe(201);
      return;
    }

    if (tabela === 'disponibilidades_virtuais') {
      await criarCompraConfirmada(data);
      return;
    }

    if (tabela === 'pedidos_venda') {
      const compraId = await criarCompraConfirmada(data);
      const pedido = await request(app.getHttpServer())
        .post('/comercial/pedidos')
        .set('Cookie', comercialCookies)
        .send({
          compraProgramadaId: compraId,
          clienteId: base.clienteId,
          dataOperacao: data,
          itens: [{ itemComercialId: base.itemComercialId, quantidadePedida: 1 }],
        });
      expect(pedido.status).toBe(201);
      return;
    }

    if (tabela === 'recebimentos') {
      const compraId = await criarCompraConfirmada(data);
      const rec = await request(app.getHttpServer())
        .post('/operacao/recebimentos')
        .set('Cookie', recebimentoCookies)
        .send({ compraProgramadaId: compraId, nfeNumero: `NF${diaSeq}` });
      expect([200, 201]).toContain(rec.status);
      return;
    }

    if (tabela === 'caminhoes') {
      const cam = await request(app.getHttpServer())
        .post('/operacao/expedicao/caminhoes')
        .set('Cookie', expedicaoCookies)
        .send({ placa: `ABC${diaSeq}D1`, motorista: 'João', dataOperacao: data });
      expect([200, 201]).toContain(cam.status);
      return;
    }

    if (tabela === 'faturamentos') {
      const cam = await request(app.getHttpServer())
        .post('/operacao/expedicao/caminhoes')
        .set('Cookie', expedicaoCookies)
        .send({ placa: `FAT${diaSeq}D1`, motorista: 'Pedro', dataOperacao: data });
      expect([200, 201]).toContain(cam.status);
      const { db } = app.get(DRIZZLE) as { db: import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema> };
      await db.update(schema.caminhoes)
        .set({ statusCaminhao: 'fechado' })
        .where(eq(schema.caminhoes.id, cam.body.id));
      const consolidar = await request(app.getHttpServer())
        .get(`/operacao/faturamento/caminhoes/${cam.body.id}/consolidacao`)
        .set('Cookie', faturamentoCookies);
      expect(consolidar.status).toBe(200);
    }
  }

  it.each([
    'compras_programadas', 'disponibilidades_virtuais', 'pedidos_venda',
    'recebimentos', 'caminhoes', 'faturamentos',
  ])('%s recebe operacao_id no fluxo público', async (tabela) => {
    await executarFluxoPublico(tabela);
    expect(await contarSemOperacao(tabela)).toBe(0);
  });
});
