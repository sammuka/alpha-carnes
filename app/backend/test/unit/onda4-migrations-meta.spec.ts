import * as fs from 'fs';
import * as path from 'path';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { clientes } from '../../src/database/schema';

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  '../../src/database/migrations',
);
const META_DIR = path.join(MIGRATIONS_DIR, 'meta');

type Journal = {
  version: string;
  dialect: string;
  entries: Array<{
    idx: number;
    version: string;
    tag: string;
    breakpoints: boolean;
  }>;
};

type Snapshot = {
  id: string;
  prevId: string;
  version: string;
  dialect: string;
  tables: Record<string, { columns: Record<string, unknown> }>;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readMigration(tag: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
}

describe('Onda 4 — proveniência das migrations D36', () => {
  it('encadeia journal e snapshots gerados de 0015 a 0018', () => {
    const journal = readJson<Journal>(path.join(META_DIR, '_journal.json'));
    const entries = journal.entries.filter((entry) => entry.idx >= 15);

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(entries.map(({ idx, tag }) => ({ idx, tag }))).toEqual([
      { idx: 15, tag: '0015_onda3_cadastros_admin' },
      { idx: 16, tag: '0016_onda4_comercial_expand' },
      { idx: 17, tag: '0017_onda4_comercial_backfill' },
      { idx: 18, tag: '0018_onda4_comercial_contract' },
    ]);
    expect(entries.every((entry) =>
      entry.version === '7' && entry.breakpoints,
    )).toBe(true);

    const snapshots = [15, 16, 17, 18].map((idx) =>
      readJson<Snapshot>(
        path.join(META_DIR, `${String(idx).padStart(4, '0')}_snapshot.json`),
      ),
    );
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(new Set(snapshots.map((snapshot) => snapshot.id)).size).toBe(4);
    expect(snapshots.every((snapshot) =>
      uuid.test(snapshot.id) &&
      snapshot.version === '7' &&
      snapshot.dialect === 'postgresql',
    )).toBe(true);
    expect(snapshots[1]!.prevId).toBe(snapshots[0]!.id);
    expect(snapshots[2]!.prevId).toBe(snapshots[1]!.id);
    expect(snapshots[3]!.prevId).toBe(snapshots[2]!.id);

    expect(snapshots[1]!.tables['public.clientes']!.columns).toHaveProperty(
      'rota_padrao',
    );
    expect(snapshots[1]!.tables['public.clientes']!.columns).toHaveProperty(
      'rota_id',
    );
    expect(snapshots[2]!.tables['public.clientes']!.columns).toHaveProperty(
      'rota_padrao',
    );
    expect(snapshots[3]!.tables['public.clientes']!.columns).not.toHaveProperty(
      'rota_padrao',
    );

    const expectedO4 = new Set([
      '0016_onda4_comercial_expand.sql',
      '0017_onda4_comercial_backfill.sql',
      '0018_onda4_comercial_contract.sql',
    ]);
    const actualO4 = fs.readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^001[678]_/.test(name));
    expect(new Set(actualO4)).toEqual(expectedO4);
  });

  it('separa ddl gerado de sql custom preservador', () => {
    const expand = readMigration('0016_onda4_comercial_expand');
    const backfill = readMigration('0017_onda4_comercial_backfill');
    const contract = readMigration('0018_onda4_comercial_contract');

    expect((expand.match(/^CREATE TABLE/gm) ?? [])).toHaveLength(4);
    expect(expand).toContain('ALTER TABLE "clientes" ADD COLUMN "rota_id" uuid');
    expect(expand).toContain(
      'CREATE INDEX "idx_clientes_rota" ON "clientes" USING btree ("rota_id")',
    );
    expect(expand).toContain(
      'WHERE "clientes"."deleted_at" IS NULL',
    );
    expect(expand).not.toMatch(/^UPDATE\b/m);
    expect(expand).not.toContain('DROP COLUMN "rota_padrao"');

    expect(backfill).toMatch(/^UPDATE "clientes" AS c/m);
    expect(backfill).toMatch(/^WITH "rotas_nome_unico" AS \(/m);
    expect(backfill).toContain('RAISE EXCEPTION \'backfill incompleto:');
    expect(backfill).not.toMatch(/^\s*(CREATE|ALTER|DROP|TRUNCATE)\b/im);

    expect(contract.trim()).toBe(
      'ALTER TABLE "clientes" DROP COLUMN "rota_padrao";',
    );

    const config = getTableConfig(clientes);
    expect(Object.keys(clientes)).toContain('rotaId');
    expect(Object.keys(clientes)).not.toContain('rotaPadrao');
    expect(config.indexes.map((index) => index.config.name)).toContain(
      'idx_clientes_rota',
    );
  });
});
