import { INestApplication } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { produtos } from '../../src/database/schema';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { seedRegrasDesdobramentoComercial } from '../../src/database/seed-regras-desdobramento-comercial';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';
import { criarCompraConfirmada, lerDisponibilidade } from '../helpers/comercial-fixtures';

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

describe('Onda 13 — unificação do catálogo (AD-15)', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let comprasCookies: string;
  let comercialCookies: string;
  let adminCookies: string;
  let fornecedorId: string;
  let clienteId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  async function refreshAuth() {
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const admin = await createTestUser(app, { perfil: 'administrador' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
  }

  beforeEach(async () => {
    await cleanupDb(app);
    ({ db } = app.get(DRIZZLE));
    await refreshAuth();
    await seedCatalogoMvp(db);
    await seedRegrasDesdobramentoComercial(db);
    const [fornecedor] = await db.insert(schema.fornecedores).values({
      codigo: uid('FORN'), razaoSocial: 'Fornecedor Onda13', documentoFiscal: uid('DOC'),
    }).returning();
    const [cliente] = await db.insert(schema.clientes).values({
      codigo: uid('CLI'), razaoSocial: 'Cliente Onda13', documentoFiscal: uid('DOCC'),
    }).returning();
    if (!fornecedor || !cliente) throw new Error('Falha ao criar fornecedor/cliente');
    fornecedorId = fornecedor.id;
    clienteId = cliente.id;
  });

  async function idsPorCodigo() {
    const rows = await db.select({ id: produtos.id, codigo: produtos.codigo }).from(produtos);
    return Object.fromEntries(rows.map((r) => [r.codigo, r.id])) as Record<string, string>;
  }

  it('DoD 13.8 compra BOI gera TZ=2 DT=2 PA=2 sem linha BOI', async () => {
    const ids = await idsPorCodigo();
    const compraId = await criarCompraConfirmada(
      app,
      comprasCookies,
      { fornecedorId, produtoCompraId: ids.BOI! },
      { dataOperacao: '2026-09-10', quantidade: 1 },
    );
    expect(compraId).toBeTruthy();

    for (const codigo of ['TZ', 'DT', 'PA'] as const) {
      const disp = await lerDisponibilidade(app, ids[codigo]!);
      expect(disp).not.toBeNull();
      expect(Number(disp!.quantidadeTotalGerada)).toBe(2);
    }
    expect(await lerDisponibilidade(app, ids.BOI!)).toBeNull();
  });

  it('DoD 13.9 compra TZ gera disponibilidade TZ fator 1', async () => {
    const ids = await idsPorCodigo();
    await criarCompraConfirmada(
      app,
      comprasCookies,
      { fornecedorId, produtoCompraId: ids.TZ! },
      { dataOperacao: '2026-09-11', quantidade: 3 },
    );
    const disp = await lerDisponibilidade(app, ids.TZ!);
    expect(Number(disp!.quantidadeTotalGerada)).toBe(3);
  });

  it('DoD 13.10 compra BPORCO gera disponibilidade BPORCO fator 1', async () => {
    const ids = await idsPorCodigo();

    await criarCompraConfirmada(
      app,
      comprasCookies,
      { fornecedorId, produtoCompraId: ids.BPORCO! },
      { dataOperacao: '2026-09-12', quantidade: 5 },
    );
    const disp = await lerDisponibilidade(app, ids.BPORCO!);
    expect(Number(disp!.quantidadeTotalGerada)).toBe(5);
  });

  it('DoD 13.12 pedido TZ reserva disponibilidade TZ', async () => {
    const ids = await idsPorCodigo();

    await criarCompraConfirmada(
      app,
      comprasCookies,
      { fornecedorId, produtoCompraId: ids.TZ! },
      { dataOperacao: '2026-09-13', quantidade: 10 },
    );

    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId,
        dataOperacao: '2026-09-13',
        itens: [{ produtoId: ids.TZ!, quantidadePedida: 2 }],
      });
    expect(pedido.status).toBe(201);

    const disp = await lerDisponibilidade(app, ids.TZ!);
    expect(Number(disp!.quantidadeReservada)).toBe(2);
  });

  it('DoD 13.11 POST pedido com itemComercialId retorna 400', async () => {
    const ids = await idsPorCodigo();

    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        clienteId,
        dataOperacao: '2026-09-14',
        itens: [{ itemComercialId: ids.TZ!, quantidadePedida: 1 }],
      });
    expect(res.status).toBe(400);
  });

  it('DoD 13.13 migrations 0034-0036 aplicam em banco seedado', async () => {
    const journal = await db.execute<{ hash: string }>(sql`
      SELECT hash FROM drizzle.__drizzle_migrations
    `);
    expect(journal.rows.length).toBeGreaterThanOrEqual(37);

    const produtoId = await db.execute<{ column_name: string; is_nullable: string }>(sql`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'disponibilidades_virtuais'
        AND column_name IN ('produto_id', 'item_comercial_id')
    `);
    expect(produtoId.rows).toHaveLength(1);
    expect(produtoId.rows[0]?.column_name).toBe('produto_id');
    expect(produtoId.rows[0]?.is_nullable).toBe('NO');

    const legadoProdutos = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'produtos'
        AND column_name IN ('legado_item_comercial_id', 'legado_item_compra_id')
    `);
    expect(legadoProdutos.rows).toHaveLength(0);

    const check = await db.execute<{ conname: string }>(sql`
      SELECT conname FROM pg_constraint
      WHERE conname = 'chk_regras_desd_origem_destino_distintos'
    `);
    expect(check.rows).toHaveLength(1);

    const ids = await idsPorCodigo();
    await expect(
      db.insert(schema.regrasDesdobramentoComercial).values({
        produtoOrigemId: ids.TZ!,
        produtoDestinoId: ids.TZ!,
        fatorQuantidade: '1',
        status: 'ativo',
        vigenciaInicio: new Date('2020-01-01T00:00:00.000Z'),
        observacoes: 'DoD 13.13 identidade ativa deve falhar no CHECK da 0036',
      }),
    ).rejects.toThrow();

    const [soft] = await db.insert(schema.regrasDesdobramentoComercial).values({
      produtoOrigemId: ids.TZ!,
      produtoDestinoId: ids.TZ!,
      fatorQuantidade: '1',
      status: 'inativo',
      vigenciaInicio: new Date('2020-01-01T00:00:00.000Z'),
      deletedAt: new Date(),
      observacoes: 'DoD 13.13 identidade soft-deleted permitida pela 0036',
    }).returning({ id: schema.regrasDesdobramentoComercial.id });
    expect(soft?.id).toBeTruthy();
  });

  it('DoD 13.7 information_schema sem itens_comerciais nem itens_compra', async () => {
    const tabelas = await db.execute<{ table_name: string }>(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('itens_comerciais', 'itens_compra')
    `);
    expect(tabelas.rows).toHaveLength(0);
  });

  it('DoD 13.6 soft-delete some do GET ativoVenda=true', async () => {
    const ids = await idsPorCodigo();
    await db.update(produtos)
      .set({ deletedAt: new Date(), status: 'inativo' })
      .where(eq(produtos.id, ids.TZ!));

    const res = await request(app.getHttpServer())
      .get('/produtos?status=ativo&ativoVenda=true&pageSize=100')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    const codigos = (res.body.data as Array<{ codigo: string }>).map((p) => p.codigo);
    expect(codigos).not.toContain('TZ');
  });
});
