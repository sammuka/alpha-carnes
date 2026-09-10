import { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import {
  clientes,
  operacoes,
  produtos,
  tabelasPreco,
  tabelasPrecoItens,
} from '../../src/database/schema';
import { PrecosService } from '../../src/modules/comercial/precos/precos.service';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

type Db = NodePgDatabase<typeof schema>;

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

function operacaoRow(data: string) {
  const d = new Date(`${data}T12:00:00`);
  return { data, diaSemana: d.getDay(), rotulo: `Op ${data}` };
}

describe('PrecosService.resolverPrecoVigente (ALP-80)', () => {
  let app: INestApplication;
  let db: Db;
  let service: PrecosService;
  const dataOp = '2026-09-15';
  const dataAnterior = '2026-09-14';
  let produtoKgId: string;
  let produtoUnId: string;
  let produtoAusenteId: string;
  let produtoNullId: string;
  let tabelaPublicadaId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
    service = app.get(PrecosService);
    await cleanupDb(app);

    const [pKg] = await db.insert(produtos).values({
      codigo: uid('PKG'),
      nome: 'Produto KG',
      unidadePedido: 'kg',
      unidadePreco: 'kg',
      ativoVenda: true,
      status: 'ativo',
    }).returning();
    const [pUn] = await db.insert(produtos).values({
      codigo: uid('PUN'),
      nome: 'Produto Unidade',
      unidadePedido: 'unidade',
      unidadePreco: 'unidade',
      ativoVenda: true,
      status: 'ativo',
    }).returning();
    const [pAus] = await db.insert(produtos).values({
      codigo: uid('PAUS'),
      nome: 'Produto Ausente',
      unidadePedido: 'kg',
      unidadePreco: 'kg',
      ativoVenda: true,
      status: 'ativo',
    }).returning();
    const [pNull] = await db.insert(produtos).values({
      codigo: uid('PNULL'),
      nome: 'Produto Null',
      unidadePedido: 'kg',
      unidadePreco: 'kg',
      ativoVenda: true,
      status: 'ativo',
    }).returning();
    if (!pKg || !pUn || !pAus || !pNull) throw new Error('Falha ao criar produtos');
    produtoKgId = pKg.id;
    produtoUnId = pUn.id;
    produtoAusenteId = pAus.id;
    produtoNullId = pNull.id;

    const [tabPub] = await db.insert(tabelasPreco).values({
      data: dataOp,
      status: 'publicada',
    }).returning();
    if (!tabPub) throw new Error('Falha ao criar tabela publicada');
    tabelaPublicadaId = tabPub.id;

    await db.insert(tabelasPrecoItens).values([
      {
        tabelaPrecoId: tabelaPublicadaId,
        produtoId: produtoKgId,
        precoA: '10.00',
        precoB: '18.50',
        precoC: '20.00',
        precoD: '22.00',
      },
      {
        tabelaPrecoId: tabelaPublicadaId,
        produtoId: produtoUnId,
        precoA: '5.00',
        precoB: '7.50',
        precoC: '8.00',
        precoD: '9.00',
      },
      {
        tabelaPrecoId: tabelaPublicadaId,
        produtoId: produtoNullId,
        precoA: '1.00',
        precoB: null,
        precoC: '3.00',
        precoD: '4.00',
      },
    ]);

    await db.insert(tabelasPreco).values({ data: '2026-09-17', status: 'rascunho' });

    const [tabAnt] = await db.insert(tabelasPreco).values({
      data: dataAnterior,
      status: 'publicada',
    }).returning();
    if (!tabAnt) throw new Error('Falha tabela anterior');
    await db.insert(tabelasPrecoItens).values({
      tabelaPrecoId: tabAnt.id,
      produtoId: produtoKgId,
      precoA: '99.00',
      precoB: '99.00',
      precoC: '99.00',
      precoD: '99.00',
    });

    const [tabDel] = await db.insert(tabelasPreco).values({
      data: '2026-09-16',
      status: 'publicada',
      deletedAt: new Date(),
    }).returning();
    if (!tabDel) throw new Error('Falha tabela deletada');
    await db.insert(tabelasPrecoItens).values({
      tabelaPrecoId: tabDel.id,
      produtoId: produtoKgId,
      precoA: '50.00',
      precoB: '50.00',
      precoC: '50.00',
      precoD: '50.00',
    });
  }, 60_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function resolver(faixa: 'A' | 'B' | 'C' | 'D', produtoId: string, data: string) {
    return db.transaction(async (tx) => service.resolverPrecoVigente(tx, {
      produtoId,
      faixa,
      data,
    }));
  }

  it('retorna precoB de tabela publicada na data exata', async () => {
    const hit = await resolver('B', produtoKgId, dataOp);
    expect(hit).toEqual({
      preco: '18.50',
      unidadePreco: 'kg',
      tabelaPrecoId: tabelaPublicadaId,
    });
  });

  it('trata tabela rascunho na data como inexistente (C4)', async () => {
    const hit = await resolver('A', produtoKgId, '2026-09-17');
    expect(hit).toBeNull();
  });

  it('nao faz fallback para dia anterior (C2)', async () => {
    const hit = await resolver('B', produtoKgId, dataOp);
    expect(hit?.preco).toBe('18.50');
    expect(hit?.preco).not.toBe('99.00');
    const semTabela = await resolver('B', produtoKgId, '2026-09-13');
    expect(semTabela).toBeNull();
  });

  it('produto ausente na tabela retorna null', async () => {
    const hit = await resolver('A', produtoAusenteId, dataOp);
    expect(hit).toBeNull();
  });

  it('coluna da faixa NULL ignora o produto (C3)', async () => {
    const hit = await resolver('B', produtoNullId, dataOp);
    expect(hit).toBeNull();
  });

  it('tabela com deleted_at e ignorada', async () => {
    const hit = await resolver('A', produtoKgId, '2026-09-16');
    expect(hit).toBeNull();
  });

  it("retorna unidadePreco='unidade' do catalogo", async () => {
    const hit = await resolver('B', produtoUnId, dataOp);
    expect(hit?.unidadePreco).toBe('unidade');
    expect(hit?.preco).toBe('7.50');
  });

  it('lote: 3 produtos consultados, 1 ausente', async () => {
    const mapa = await db.transaction(async (tx) => service.resolverPrecosVigentes(tx, {
      produtoIds: [produtoKgId, produtoUnId, produtoAusenteId],
      faixa: 'B',
      data: dataOp,
    }));
    expect(mapa.size).toBe(2);
    expect(mapa.get(produtoKgId)?.preco).toBe('18.50');
    expect(mapa.get(produtoUnId)?.preco).toBe('7.50');
    expect(mapa.has(produtoAusenteId)).toBe(false);
  });
});

describe('GET /precos/vigente (HTTP)', () => {
  let app: INestApplication;
  let db: Db;
  let gestorCookies: string;
  let recebCookies: string;
  let clienteId: string;
  let operacaoId: string;
  let produtoId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
    await cleanupDb(app);

    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const receb = await createTestUser(app, { perfil: 'recebimento_pesagem' });
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    recebCookies = await loginCookies(app, receb.adminEmail, receb.adminPassword);

    const [cliente] = await db.insert(clientes).values({
      codigo: uid('CLI'),
      razaoSocial: 'Cliente Vigente',
      documentoFiscal: uid('DOC'),
      faixaPreco: 'B',
    }).returning();
    const [op] = await db.insert(operacoes).values(operacaoRow('2026-09-20')).returning();
    const [prod] = await db.insert(produtos).values({
      codigo: uid('PV'),
      nome: 'Vigente HTTP',
      unidadePedido: 'kg',
      unidadePreco: 'kg',
      ativoVenda: true,
      status: 'ativo',
    }).returning();
    if (!cliente || !op || !prod) throw new Error('setup HTTP');
    clienteId = cliente.id;
    operacaoId = op.id;
    produtoId = prod.id;

    const [tab] = await db.insert(tabelasPreco).values({
      data: '2026-09-20',
      status: 'publicada',
    }).returning();
    if (!tab) throw new Error('tab');
    await db.insert(tabelasPrecoItens).values({
      tabelaPrecoId: tab.id,
      produtoId,
      precoA: '1.00',
      precoB: '12.34',
      precoC: '3.00',
      precoD: '4.00',
    });
  }, 60_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('403 sem TABELA_PRECO_LER', async () => {
    const qs = new URLSearchParams({
      clienteId,
      operacaoId,
      produtoIds: produtoId,
    });
    const res = await request(app.getHttpServer())
      .get(`/precos/vigente?${qs}`)
      .set('Cookie', recebCookies);
    expect(res.status).toBe(403);
  });

  it('404 operacao inexistente', async () => {
    const qs = new URLSearchParams({
      clienteId,
      operacaoId: '00000000-0000-4000-8000-000000000099',
      produtoIds: produtoId,
    });
    const res = await request(app.getHttpServer())
      .get(`/precos/vigente?${qs}`)
      .set('Cookie', gestorCookies);
    expect(res.status).toBe(404);
  });

  it('404 cliente inexistente', async () => {
    const qs = new URLSearchParams({
      clienteId: '00000000-0000-4000-8000-000000000088',
      operacaoId,
      produtoIds: produtoId,
    });
    const res = await request(app.getHttpServer())
      .get(`/precos/vigente?${qs}`)
      .set('Cookie', gestorCookies);
    expect(res.status).toBe(404);
  });

  it('envelope { data } sem chave itens', async () => {
    const qs = new URLSearchParams({
      clienteId,
      operacaoId,
      produtoIds: produtoId,
    });
    const res = await request(app.getHttpServer())
      .get(`/precos/vigente?${qs}`)
      .set('Cookie', gestorCookies);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: expect.any(Array) });
    expect(res.body).not.toHaveProperty('itens');
    const linha = res.body.data[0];
    expect(linha).toEqual({
      produtoId,
      preco: '12.34',
      unidadePreco: 'kg',
      tabelaPrecoId: expect.any(String),
    });
  });

  it('sem vigente: preco, unidadePreco e tabelaPrecoId null', async () => {
    const [opSemTab] = await db.insert(operacoes).values(operacaoRow('2026-09-21')).returning();
    if (!opSemTab) throw new Error('op');
    const qs = new URLSearchParams({
      clienteId,
      operacaoId: opSemTab.id,
      produtoIds: produtoId,
    });
    const res = await request(app.getHttpServer())
      .get(`/precos/vigente?${qs}`)
      .set('Cookie', gestorCookies);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({
      produtoId,
      preco: null,
      unidadePreco: null,
      tabelaPrecoId: null,
    });
  });
});
