import { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

type Db = NodePgDatabase<typeof schema>;

let cnpjSeq = 22_333_444;
function proximoCnpj(): string {
  cnpjSeq += 1;
  const base = `${String(cnpjSeq).padStart(8, '0')}0001`;
  const calc = (slice: string, pesos: number[]) => {
    const nums = slice.split('').map(Number);
    const soma = nums.reduce((s, n, i) => s + n * pesos[i]!, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(`${base}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

function pathsDeValidacao(body: { message?: { errors?: Array<{ path: (string | number)[] }> } }): string[] {
  const issues = body.message?.errors ?? [];
  return issues.map((i) => i.path.join('.'));
}

describe('Onda 14 — clientes.faixa_preco (ALP-78)', () => {
  let app: INestApplication;
  let db: Db;
  let adminCookies: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ db } = app.get(DRIZZLE));
    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
  }, 60_000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const novoCliente = (over: Record<string, unknown> = {}) => ({
    codigo: `CLI-O14-${Math.floor(performance.now() * 1000)}-${Math.floor(Math.random() * 1e6)}`,
    razaoSocial: 'Cliente Onda14 Faixa LTDA',
    documentoFiscal: proximoCnpj(),
    ...over,
  });

  it('POST /clientes sem faixaPreco → 400, chave faixaPreco', async () => {
    const res = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente());
    expect(res.status).toBe(400);
    expect(pathsDeValidacao(res.body)).toContain('faixaPreco');
  });

  it("POST /clientes com faixaPreco 'E' → 400", async () => {
    const res = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente({ faixaPreco: 'E' }));
    expect(res.status).toBe(400);
    expect(pathsDeValidacao(res.body)).toContain('faixaPreco');
  });

  it('PATCH /clientes/:id com faixaPreco null → 400', async () => {
    const criado = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente({ faixaPreco: 'A' }));
    expect(criado.status).toBe(201);

    const res = await request(app.getHttpServer())
      .patch(`/clientes/${criado.body.id}`)
      .set('Cookie', adminCookies)
      .send({ faixaPreco: null });
    expect(res.status).toBe(400);
    expect(pathsDeValidacao(res.body)).toContain('faixaPreco');
  });

  it('PATCH válido A→C persiste e detalhar/listar refletem', async () => {
    const criado = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente({ faixaPreco: 'A' }));
    expect(criado.status).toBe(201);
    expect(criado.body.faixaPreco).toBe('A');

    const patch = await request(app.getHttpServer())
      .patch(`/clientes/${criado.body.id}`)
      .set('Cookie', adminCookies)
      .send({ faixaPreco: 'C' });
    expect(patch.status).toBe(200);
    expect(patch.body.faixaPreco).toBe('C');

    const detalhe = await request(app.getHttpServer())
      .get(`/clientes/${criado.body.id}`)
      .set('Cookie', adminCookies);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.faixaPreco).toBe('C');

    const lista = await request(app.getHttpServer())
      .get('/clientes')
      .query({ search: criado.body.codigo })
      .set('Cookie', adminCookies);
    expect(lista.status).toBe(200);
    const linha = (lista.body.data as Array<{ id: string; faixaPreco: string }>).find(
      (c) => c.id === criado.body.id,
    );
    expect(linha?.faixaPreco).toBe('C');
  });

  it('backfill: count(*) WHERE faixa_preco IS NULL = 0 (ativos e soft-deleted)', async () => {
    const rows = await db.execute(sql`SELECT count(*)::int AS nulos FROM clientes WHERE faixa_preco IS NULL`);
    const nulos = Number((rows.rows[0] as { nulos: number }).nulos);
    expect(nulos).toBe(0);
  });

  it("CHECK rejeita 'X' via SQL direto", async () => {
    const criado = await request(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente({ faixaPreco: 'A' }));
    expect(criado.status).toBe(201);

    try {
      await db.execute(sql`UPDATE clientes SET faixa_preco = 'X' WHERE id = ${criado.body.id}::uuid`);
      throw new Error('CHECK deveria ter rejeitado faixa_preco X');
    } catch (err) {
      const code =
        (err as { code?: string }).code
        ?? (err as { cause?: { code?: string } }).cause?.code;
      expect(code).toBe('23514');
    }
  });
});
