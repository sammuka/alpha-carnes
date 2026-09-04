import { INestApplication } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { disponibilidadesVirtuais, produtos } from '../../src/database/schema';
import { seedCatalogoMvp } from '../../src/database/seed-catalogo-mvp';
import { seedRegrasDesdobramentoComercial } from '../../src/database/seed-regras-desdobramento-comercial';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

function uid(prefix: string): string {
  return `${prefix}-${Math.round(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`;
}

describe('Onda 13 — unificação do catálogo (AD-15)', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;
  let adminCookies: string;
  let comprasCookies: string;
  let comercialCookies: string;
  let fornecedorId: string;
  let clienteId: string;
  let ids: Record<'BOI' | 'TZ' | 'DT' | 'PA' | 'BPORCO', string>;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
    const admin = await createTestUser(app, { perfil: 'administrador' });
    const compras = await createTestUser(app, { perfil: 'compras' });
    const comercial = await createTestUser(app, { perfil: 'comercial' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
    comprasCookies = await loginCookies(app, compras.adminEmail, compras.adminPassword);
    comercialCookies = await loginCookies(app, comercial.adminEmail, comercial.adminPassword);
  }, 60_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDb(app);
    await seedCatalogoMvp(db);
    await seedRegrasDesdobramentoComercial(db);

    const prods = await db.select({ id: produtos.id, codigo: produtos.codigo }).from(produtos);
    ids = Object.fromEntries(prods.map((p) => [p.codigo, p.id])) as typeof ids;

    const fornecedor = await request(app.getHttpServer())
      .post('/fornecedores')
      .set('Cookie', adminCookies)
      .send({ codigo: uid('FORN'), razaoSocial: 'Frigorífico O13', documentoFiscal: '11222333000181' });
    fornecedorId = fornecedor.body.id as string;

    const cliente = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send({ codigo: uid('CLI'), razaoSocial: 'Cliente O13', documentoFiscal: '04252011000110' });
    clienteId = cliente.body.id as string;
  });

  async function confirmarCompra(produtoCompraId: string, dataOperacao: string, quantidade: number) {
    const criar = await request(app.getHttpServer())
      .post('/comercial/compras-programadas')
      .set('Cookie', comprasCookies)
      .send({
        dataOperacao,
        fornecedorId,
        itens: [{ produtoId: produtoCompraId, quantidadeComprada: quantidade }],
      });
    expect(criar.status).toBe(201);
    const compraId = criar.body.id as string;
    const confirmar = await request(app.getHttpServer())
      .post(`/comercial/compras-programadas/${compraId}/confirmar`)
      .set('Cookie', comprasCookies)
      .send();
    expect([200, 201]).toContain(confirmar.status);
    return compraId;
  }

  async function dispPorCodigo(codigo: string) {
    const [row] = await db
      .select({
        codigo: produtos.codigo,
        quantidadeTotalGerada: disponibilidadesVirtuais.quantidadeTotalGerada,
      })
      .from(disponibilidadesVirtuais)
      .innerJoin(produtos, eq(produtos.id, disponibilidadesVirtuais.produtoId))
      .where(eq(produtos.codigo, codigo));
    return row ?? null;
  }

  it('DoD 13.8 compra BOI gera TZ=2 DT=2 PA=2 sem linha BOI', async () => {
    await confirmarCompra(ids.BOI, '2026-09-10', 1);
    expect(Number((await dispPorCodigo('TZ'))?.quantidadeTotalGerada)).toBe(2);
    expect(Number((await dispPorCodigo('DT'))?.quantidadeTotalGerada)).toBe(2);
    expect(Number((await dispPorCodigo('PA'))?.quantidadeTotalGerada)).toBe(2);
    expect(await dispPorCodigo('BOI')).toBeNull();
  });

  it('DoD 13.9 compra TZ gera disponibilidade TZ fator 1', async () => {
    await confirmarCompra(ids.TZ, '2026-09-11', 3);
    expect(Number((await dispPorCodigo('TZ'))?.quantidadeTotalGerada)).toBe(3);
  });

  it('DoD 13.10 compra BPORCO gera disponibilidade BPORCO fator 1', async () => {
    await confirmarCompra(ids.BPORCO, '2026-09-12', 5);
    expect(Number((await dispPorCodigo('BPORCO'))?.quantidadeTotalGerada)).toBe(5);
  });

  it('DoD 13.12 pedido TZ reserva disponibilidade TZ', async () => {
    await confirmarCompra(ids.TZ, '2026-09-13', 10);
    const antes = await db
      .select()
      .from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.produtoId, ids.TZ));
    expect(Number(antes[0]?.quantidadeDisponivel)).toBe(10);

    const pedido = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        operacaoId: antes[0]!.operacaoId,
        dataOperacao: '2026-09-13',
        clienteId,
        itens: [{ produtoId: ids.TZ, quantidadePedida: 4 }],
      });
    expect(pedido.status).toBe(201);

    const depois = await db
      .select()
      .from(disponibilidadesVirtuais)
      .where(eq(disponibilidadesVirtuais.produtoId, ids.TZ));
    expect(Number(depois[0]?.quantidadeReservada)).toBe(4);
    expect(Number(depois[0]?.quantidadeDisponivel)).toBe(6);
  });

  it('DoD 13.11 POST pedido com itemComercialId retorna 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/comercial/pedidos')
      .set('Cookie', comercialCookies)
      .send({
        dataOperacao: '2026-09-14',
        clienteId,
        itens: [{ itemComercialId: ids.TZ, quantidadePedida: 1 }],
      });
    expect(res.status).toBe(400);
  });

  it('DoD 13.13 migrations 0034-0036 aplicam em banco seedado', async () => {
    const cols = await db.execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'disponibilidades_virtuais'
        AND column_name IN ('produto_id', 'item_comercial_id')
    `);
    const names = cols.rows.map((r) => r.column_name);
    expect(names).toContain('produto_id');
    expect(names).not.toContain('item_comercial_id');
  });

  it('DoD 13.7 information_schema sem itens_comerciais nem itens_compra', async () => {
    const tabelas = await db.execute<{ table_name: string }>(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('itens_comerciais', 'itens_compra')
    `);
    expect(tabelas.rows).toHaveLength(0);
  });

  it('DoD 13.6 soft-delete some do GET ativoVenda=true', async () => {
    const criado = await request(app.getHttpServer())
      .post('/produtos')
      .set('Cookie', adminCookies)
      .send({
        codigo: uid('SOFT'),
        nome: 'Produto soft delete',
        unidadePedido: 'kg',
        ativoVenda: true,
        ativoCompra: false,
      });
    expect(criado.status).toBe(201);
    const produtoId = criado.body.id as string;

    await request(app.getHttpServer())
      .delete(`/produtos/${produtoId}`)
      .set('Cookie', adminCookies)
      .send();

    const lista = await request(app.getHttpServer())
      .get('/produtos?status=ativo&ativoVenda=true')
      .set('Cookie', adminCookies);
    expect(lista.status).toBe(200);
    const codigos = (lista.body.data as Array<{ id: string }>).map((p) => p.id);
    expect(codigos).not.toContain(produtoId);
  });
});
