import { INestApplication } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { produtos, tabelasPrecoItens } from '../../src/database/schema';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

type Db = NodePgDatabase<typeof schema>;

interface ItemDetalhe {
  produtoId: string;
  codigo: string;
  precoA: string | null;
  precoB: string | null;
  precoC: string | null;
  precoD: string | null;
}

interface TabelaDetalhe {
  id: string;
  data: string;
  status: string;
  itens: ItemDetalhe[];
  historico: Array<{ acao: string; observacao: string | null }>;
}

describe('precos.tabelas — Onda 4 (D13/D14/D15/D16)', () => {
  let app: INestApplication;
  let db: Db;
  let gestorCookies: string;
  let comercialCookies: string;
  let produtoPorCodigo: Map<string, string>;

  async function request() {
    return (await import('supertest')).default;
  }

  async function criarTabela(data: string, observacao?: string): Promise<TabelaDetalhe> {
    const req = await request();
    const res = await req(app.getHttpServer())
      .post('/precos/tabelas')
      .set('Cookie', gestorCookies)
      .send({ data, observacao });
    if (res.status !== 201) throw new Error(`Falha ao criar tabela: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as TabelaDetalhe;
  }

  async function salvarItens(
    id: string, itens: Array<{ produtoId: string; precoA?: number | null; precoB?: number | null; precoC?: number | null; precoD?: number | null }>,
  ) {
    const req = await request();
    const res = await req(app.getHttpServer())
      .patch(`/precos/tabelas/${id}/itens`)
      .set('Cookie', gestorCookies)
      .send({ itens });
    if (res.status !== 200) throw new Error(`Falha ao salvar itens: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as TabelaDetalhe;
  }

  function todasAsFaixas(precoBase: number) {
    return { precoA: precoBase, precoB: precoBase + 1, precoC: precoBase + 2, precoD: precoBase + 3 };
  }

  async function preencherTodosOsProdutos(id: string, precoBase: number) {
    const itens = [...produtoPorCodigo.values()].map((produtoId) => ({
      produtoId, ...todasAsFaixas(precoBase),
    }));
    return salvarItens(id, itens);
  }

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
    await cleanupDb(app);
    await seedCatalogoMvp(db);
    const linhas = await db.select({ id: produtos.id, codigo: produtos.codigo }).from(produtos);
    produtoPorCodigo = new Map(linhas.map((l) => [l.codigo, l.id]));
    // Usuários criados uma única vez: `cleanupDb` (TRUNCATE CASCADE em `usuarios`) invalidaria
    // o `publicada_por` (FK) das tabelas já publicadas se recriássemos a cada teste — cada teste
    // usa uma data distinta para não conflitar com `uq_tabelas_preco_data`.
    const gestor = await createTestUser(app, { perfil: 'gestor' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    gestorCookies = await loginCookies(app, gestor.adminEmail, gestor.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('publicar com preco faltando retorna 400 PRECOS_INCOMPLETOS com os produtos', async () => {
    const tabela = await criarTabela('2026-03-01');
    const req = await request();
    const res = await req(app.getHttpServer())
      .post(`/precos/tabelas/${tabela.id}/publicar`)
      .set('Cookie', gestorCookies)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message.code).toBe('PRECOS_INCOMPLETOS');
    expect(Array.isArray(res.body.message.produtos)).toBe(true);
    expect(res.body.message.produtos.length).toBeGreaterThan(0);
  });

  it('editar tabela publicada volta para rascunho e registra reversao no historico', async () => {
    const tabela = await criarTabela('2026-03-02');
    await preencherTodosOsProdutos(tabela.id, 10);
    const req = await request();
    const publicar = await req(app.getHttpServer())
      .post(`/precos/tabelas/${tabela.id}/publicar`)
      .set('Cookie', gestorCookies)
      .send({});
    expect(publicar.status).toBe(200);
    expect(publicar.body.status).toBe('publicada');

    const tzId = produtoPorCodigo.get('TZ')!;
    const editada = await salvarItens(tabela.id, [{ produtoId: tzId, ...todasAsFaixas(50) }]);
    expect(editada.status).toBe('rascunho');
    expect(editada.historico.some((h) => h.acao === 'revertida_para_rascunho')).toBe(true);
  });

  it('recusa segunda tabela de preco para a mesma data', async () => {
    await criarTabela('2026-03-03');
    const req = await request();
    const res = await req(app.getHttpServer())
      .post('/precos/tabelas')
      .set('Cookie', gestorCookies)
      .send({ data: '2026-03-03' });
    expect(res.status).toBe(409);
    expect(res.body.message.code).toBe('TABELA_PRECO_DUPLICADA');
  });

  it('publicar sem TABELA_PRECO_GERENCIAR retorna 403', async () => {
    const tabela = await criarTabela('2026-03-04');
    await preencherTodosOsProdutos(tabela.id, 10);
    const req = await request();
    const res = await req(app.getHttpServer())
      .post(`/precos/tabelas/${tabela.id}/publicar`)
      .set('Cookie', comercialCookies)
      .send({});
    expect(res.status).toBe(403);
  });

  it('copiar sem origemId usa a ultima publicada anterior e devolve 409 quando nao existe anterior', async () => {
    // Sem nenhuma tabela publicada anterior a esta data → 409, grade permanece intacta (null).
    const semAnterior = await criarTabela('2026-04-01');
    const req = await request();
    const falha = await req(app.getHttpServer())
      .post(`/precos/tabelas/${semAnterior.id}/copiar`)
      .set('Cookie', gestorCookies)
      .send({});
    expect(falha.status).toBe(409);
    expect(falha.body.message.code).toBe('SEM_TABELA_PRECO_ANTERIOR');
    const tzId = produtoPorCodigo.get('TZ')!;
    const detalheIntacto = await req(app.getHttpServer())
      .get(`/precos/tabelas/${semAnterior.id}`)
      .set('Cookie', gestorCookies);
    const itemIntacto = (detalheIntacto.body as TabelaDetalhe).itens.find((i) => i.produtoId === tzId)!;
    expect(itemIntacto.precoA).toBeNull();

    // Publica uma tabela anterior e cria uma posterior com preços diferentes → copiar traz da anterior.
    const anterior = await criarTabela('2026-04-05');
    await preencherTodosOsProdutos(anterior.id, 20);
    await req(app.getHttpServer())
      .post(`/precos/tabelas/${anterior.id}/publicar`)
      .set('Cookie', gestorCookies)
      .send({});

    const posterior = await criarTabela('2026-04-10');
    await salvarItens(posterior.id, [{ produtoId: tzId, ...todasAsFaixas(999) }]);

    const copia = await req(app.getHttpServer())
      .post(`/precos/tabelas/${posterior.id}/copiar`)
      .set('Cookie', gestorCookies)
      .send({});
    expect(copia.status).toBe(200);
    const itemCopiado = (copia.body as TabelaDetalhe).itens.find((i) => i.produtoId === tzId)!;
    expect(itemCopiado.precoA).toBe('20.00');
  });

  it('copiar sobrescreve as faixas dos produtos da origem e preserva os ausentes', async () => {
    const origem = await criarTabela('2026-05-01');
    const tzId = produtoPorCodigo.get('TZ')!;
    const dtId = produtoPorCodigo.get('DT')!;
    const paId = produtoPorCodigo.get('PA')!;
    await salvarItens(origem.id, [
      { produtoId: tzId, ...todasAsFaixas(10) },
      { produtoId: dtId, precoA: 20, precoB: null, precoC: null, precoD: null },
    ]);
    // Simula produto "ausente" na origem: remove a linha da grade diretamente.
    await db.delete(tabelasPrecoItens).where(and(
      eq(tabelasPrecoItens.produtoId, paId),
      eq(tabelasPrecoItens.tabelaPrecoId, origem.id),
    ));

    const destino = await criarTabela('2026-05-02');
    await salvarItens(destino.id, [{ produtoId: paId, precoA: 99, precoB: 99, precoC: 99, precoD: 99 }]);

    const req = await request();
    const copia = await req(app.getHttpServer())
      .post(`/precos/tabelas/${destino.id}/copiar`)
      .set('Cookie', gestorCookies)
      .send({ origemId: origem.id });
    expect(copia.status).toBe(200);
    const body = copia.body as TabelaDetalhe;
    const tzCopiado = body.itens.find((i) => i.produtoId === tzId)!;
    const dtCopiado = body.itens.find((i) => i.produtoId === dtId)!;
    const paIntacto = body.itens.find((i) => i.produtoId === paId)!;
    expect(tzCopiado.precoA).toBe('10.00');
    expect(dtCopiado.precoA).toBe('20.00');
    expect(dtCopiado.precoB).toBeNull();
    expect(paIntacto.precoA).toBe('99.00');
  });

  it('copiar em tabela publicada volta para rascunho e registra reversao no historico', async () => {
    const origem = await criarTabela('2026-06-01');
    await preencherTodosOsProdutos(origem.id, 30);

    const destino = await criarTabela('2026-06-02');
    await preencherTodosOsProdutos(destino.id, 40);
    const req = await request();
    await req(app.getHttpServer())
      .post(`/precos/tabelas/${destino.id}/publicar`)
      .set('Cookie', gestorCookies)
      .send({});

    const copia = await req(app.getHttpServer())
      .post(`/precos/tabelas/${destino.id}/copiar`)
      .set('Cookie', gestorCookies)
      .send({ origemId: origem.id });
    expect(copia.status).toBe(200);
    const body = copia.body as TabelaDetalhe;
    expect(body.status).toBe('rascunho');
    expect(body.historico.some((h) => h.acao === 'revertida_para_rascunho')).toBe(true);
  });
});
