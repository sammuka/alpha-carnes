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
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    const admin = await createTestUser(app, { perfil: 'administrador' });
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDb(app);
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
    const cols = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'disponibilidades_virtuais' AND column_name = 'produto_id'
    `);
    expect(cols.rows.length).toBe(1);
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
