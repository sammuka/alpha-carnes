import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import { cleanupDb, createTestApp } from '../helpers/test-app';

/**
 * E01-T05 — homologação de regras.
 * Sem data comercial, fiscal ou efetiva e sem mudar a escala do percentual da regra.
 */
describe('E01-T05 — migration de homologações de regras', () => {
  let app: INestApplication;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get<{ db: NodePgDatabase<typeof schema> }>(DRIZZLE).db;
  });

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  it('homologação não cria data comercial nem percentual', async () => {
    const cols = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'homologacoes_regras'
    `);
    const nomes = cols.rows.map((r) => r.column_name);
    for (const proibida of ['data_comercial', 'data_fiscal', 'data_efetiva', 'p_red_bc', 'p_icms']) {
      expect(nomes).not.toContain(proibida);
    }
    const escala = await db.execute(sql`
      SELECT column_name, numeric_precision::int AS numeric_precision, numeric_scale::int AS numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'regras_tributarias' AND column_name IN ('p_red_bc', 'p_icms')
    `);
    expect(escala.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ column_name: 'p_red_bc', numeric_precision: 5, numeric_scale: 4 }),
      expect.objectContaining({ column_name: 'p_icms', numeric_precision: 5, numeric_scale: 4 }),
    ]));
  });

  it('sem FK para nota', async () => {
    const fks = await db.execute(sql`
      SELECT confrelid::regclass::text AS destino
      FROM pg_constraint
      WHERE conrelid IN ('homologacoes_regras'::regclass, 'cenarios_regressao'::regclass)
        AND contype = 'f'
    `);
    const destinos = fks.rows.map((r) => r.destino);
    expect(destinos.join(' ')).not.toMatch(/notas_fiscais/);
  });

  it('o journal tem 0048_e01_t05_homologacoes_regras no idx 48 e só migrations posteriores depois dela', () => {
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), 'src/database/migrations/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ idx: number; tag: string }> };
    const posicao = journal.entries.findIndex((e) => e.tag === '0048_e01_t05_homologacoes_regras');
    expect(journal.entries[posicao]?.idx).toBe(48);
    for (const posterior of journal.entries.slice(posicao + 1)) {
      expect(Number(posterior.tag.slice(0, 4))).toBeGreaterThan(48);
    }
  });
});
