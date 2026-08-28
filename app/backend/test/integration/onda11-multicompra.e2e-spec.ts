import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import {
  seedComercialBase,
  criarCompraConfirmada,
  criarPedidoFornecedorEnviado,
  iniciarRecebimentoViaPf,
} from '../helpers/comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes } from '../helpers/pesagem-fixtures';

type Db = NodePgDatabase<typeof schema>;

describe('Onda 11 — snapshot físico e composição por lote', () => {
  let app: INestApplication;
  let comercialCookies: string;
  let comprasCookies: string;
  let recebimentoCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    recebimentoCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(() => {
    fakes(app).balanca.definirStatus('disponivel');
    fakes(app).balanca.definirPeso('12.500');
  });

  it('nenhum service muta pecas.compra_programada_id', () => {
    const src = path.resolve(__dirname, '../../src');
    const setSql = spawnSync('rg', ['-n', 'SET compra_programada_id', src], { encoding: 'utf8' });
    expect(setSql.stdout ?? '').toBe('');
    const pecasUpdate = spawnSync('rg', ['-n', '-g', '*.ts', String.raw`update\(pecas\)`, src], { encoding: 'utf8' });
    const arquivos = [...new Set(
      (pecasUpdate.stdout ?? '')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((linha) => linha.split(':')[0]!)
        .filter((p) => p.endsWith('.ts')),
    )];
    for (const arquivo of arquivos) {
      const conteudo = fs.readFileSync(arquivo, 'utf8');
      const blocos = conteudo.split(/\.update\(pecas\)/);
      for (const bloco of blocos.slice(1)) {
        const setMatch = bloco.match(/\.set\(\{[\s\S]*?\}\)/);
        expect(setMatch?.[0] ?? '').not.toMatch(/compraProgramadaId\s*:/);
      }
    }
  });

  it('confirmar carimba compra e recebimento de origem no historico', async () => {
    const c = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      await seedComercialBase(app, { fator: 1 }),
      { dataOperacao: '2026-12-30', quantidade: 6 },
    );
    const pedido = await criarPedido(app, comercialCookies, {
      compraId: c.compraId,
      clienteId: c.clienteId,
      itemComercialId: c.itemComercialId,
      dataOperacao: c.dataOperacao,
      quantidade: 2,
    });
    const pecaId = await pesarPeca(app, recebimentoCookies, {
      recebimentoId: c.recebimentoId,
      itemComercialBaseId: c.itemComercialId,
    });
    const ok = await request(app.getHttpServer())
      .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
      .set('Cookie', recebimentoCookies)
      .send({ pedidoVendaItemId: pedido.pedidoItemId });
    expect(ok.status).toBe(201);

    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const hist = await db.select().from(schema.associacoesPecaHistorico)
      .where(eq(schema.associacoesPecaHistorico.pecaId, pecaId));
    expect(hist.length).toBeGreaterThan(0);
    expect(hist.every((h) => h.compraProgramadaOrigemId === c.compraId)).toBe(true);
    expect(hist.every((h) => h.recebimentoOrigemId === c.recebimentoId)).toBe(true);
  });

  it('composicao-lotes agrupa 6 pecas do lote 001 e 4 do lote 002', async () => {
    const dia = '2026-12-31';
    const base = await seedComercialBase(app, { fator: 1 });
    const c1 = await montarCenarioPesagem(
      app,
      { compras: comprasCookies, recebimento: recebimentoCookies },
      base,
      { dataOperacao: dia, quantidade: 6 },
    );
    const compra2 = await criarCompraConfirmada(app, comprasCookies, base, { dataOperacao: dia, quantidade: 4 });
    const pf2 = await criarPedidoFornecedorEnviado(app, comprasCookies, compra2);
    const { recebimentoId: rec2 } = await iniciarRecebimentoViaPf(app, recebimentoCookies, pf2);
    const pedido = await criarPedido(app, comercialCookies, {
      compraId: c1.compraId,
      clienteId: c1.clienteId,
      itemComercialId: c1.itemComercialId,
      dataOperacao: dia,
      quantidade: 10,
    });

    const { db } = app.get<{ db: Db }>(DRIZZLE);
    const inserir = async (n: number, compraId: string, recebimentoId: string) => {
      for (let i = 0; i < n; i += 1) {
        await db.insert(schema.pecas).values({
          compraProgramadaId: compraId,
          recebimentoId,
          itemComercialBaseId: c1.itemComercialId,
          pesoOriginal: '1.000',
          modoCapturaPeso: 'automatico',
          statusPeca: 'associada',
          pedidoVendaId: pedido.pedidoId,
          pedidoVendaItemId: pedido.pedidoItemId,
        });
      }
    };
    await inserir(6, c1.compraId, c1.recebimentoId);
    await inserir(4, compra2, rec2);

    const res = await request(app.getHttpServer())
      .get(`/comercial/pedidos/${pedido.pedidoId}/composicao-lotes`)
      .set('Cookie', comercialCookies);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ numeroSequencial: 1, quantidadeUnidades: 6, compraProgramadaId: c1.compraId, recebimentoId: c1.recebimentoId }),
      expect.objectContaining({ numeroSequencial: 2, quantidadeUnidades: 4, compraProgramadaId: compra2, recebimentoId: rec2 }),
    ]));
    expect(res.body).toHaveLength(2);
  });
});
