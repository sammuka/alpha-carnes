import { INestApplication } from '@nestjs/common';
import type { Pool } from 'pg';
import { DRIZZLE } from '../../src/database/database.module';
import { cleanupDb, createTestApp } from '../helpers/test-app';

/**
 * E01-T02 — schema de enquadramentos e catálogos manuais (D7, D8, H-E01-10).
 * Catálogos nascem vazios; só há vigencia_inicio e vigencia_fim.
 */
describe('E01-T02 — migration de enquadramentos fiscais', () => {
  let app: INestApplication;
  let pool: Pool;
  let usuarioId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ pool } = app.get<{ pool: Pool }>(DRIZZLE));
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDb(app);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES ('Fiscal E01-T02', 'e01-t02-mig@test.local', 'x') RETURNING id`,
    );
    usuarioId = rows[0]!.id;
  });

  async function codigoErro(promessa: Promise<unknown>): Promise<string | undefined> {
    try {
      await promessa;
      return undefined;
    } catch (e) {
      return (e as { code?: string }).code;
    }
  }

  it('cfops, ncms e enquadramentos_fiscais existem e COUNT(*) = 0 depois do migrate', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])
        ORDER BY table_name`,
      [['cfops', 'enquadramentos_fiscais', 'ncms']],
    );
    expect(rows.map((r) => r.table_name)).toEqual(['cfops', 'enquadramentos_fiscais', 'ncms']);

    const contagens = await pool.query<{ cfops: string; ncms: string; enquadramentos: string }>(
      `SELECT
         (SELECT COUNT(*) FROM cfops) AS cfops,
         (SELECT COUNT(*) FROM ncms) AS ncms,
         (SELECT COUNT(*) FROM enquadramentos_fiscais) AS enquadramentos`,
    );
    expect(contagens.rows[0]).toEqual({ cfops: '0', ncms: '0', enquadramentos: '0' });
  });

  it('uq_cfops_codigo, uq_ncms_codigo e uq_enquadramentos_codigo são parciais', async () => {
    const { rows } = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE indexname IN ('uq_cfops_codigo', 'uq_ncms_codigo', 'uq_enquadramentos_codigo')
        ORDER BY indexname`,
    );
    expect(rows.map((r) => r.indexname)).toEqual([
      'uq_cfops_codigo', 'uq_enquadramentos_codigo', 'uq_ncms_codigo',
    ]);
    for (const r of rows) {
      expect(r.indexdef).toMatch(/^CREATE UNIQUE INDEX/);
      expect(r.indexdef).toMatch(/WHERE .*deleted_at IS NULL/);
    }
  });

  it('FK (estabelecimento_id, empresa_id) existe', async () => {
    const { rows } = await pool.query<{ conname: string; def: string }>(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = 'enquadramentos_fiscais_estabelecimento_empresa_fk'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.def).toMatch(/FOREIGN KEY \(estabelecimento_id, empresa_id\)/);
    expect(rows[0]!.def).toMatch(/REFERENCES estabelecimentos\(id, empresa_id\)/);
  });

  it('information_schema.columns de enquadramentos_fiscais não contém comercial, fiscal_em nem efetiva', async () => {
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'enquadramentos_fiscais'`,
    );
    const nomes = rows.map((r) => r.column_name);
    expect(nomes).toEqual(expect.arrayContaining(['vigencia_inicio', 'vigencia_fim']));
    expect(nomes.some((n) => /comercial|fiscal_em|efetiva|data_comercial|data_fiscal|data_efetiva/.test(n))).toBe(false);
  });

  it('insert de CFOP ABCD viola o CHECK', async () => {
    expect(await codigoErro(pool.query(
      `INSERT INTO cfops (codigo, descricao, criado_por_id, atualizado_por_id)
       VALUES ('ABCD', 'Fora do formato', $1, $1)`,
      [usuarioId],
    ))).toBe('23514');
  });
});
