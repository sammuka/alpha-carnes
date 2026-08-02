import * as fs from 'fs';
import * as path from 'path';

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
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function readMigration(tag: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
}

describe('Onda 9 — proveniência da migration de carga (frota + divergência)', () => {
  it('0024_onda9_carga_expand é DDL puro, sem DML', () => {
    const expand = readMigration('0024_onda9_carga_expand');

    expect(expand).toContain(
      'ALTER TABLE "caminhoes" ADD COLUMN "frota_caminhao_id" uuid;',
    );
    expect(expand).toContain(
      'ALTER TABLE "carga_itens" ADD COLUMN "divergencia_motivo" text;',
    );
    expect(expand).toContain(
      'ALTER TABLE "carga_itens" ADD COLUMN "divergencia_observacao" text;',
    );
    expect(expand).toContain(
      'ALTER TABLE "caminhoes" ADD CONSTRAINT "caminhoes_frota_caminhao_id_frota_caminhoes_id_fk"',
    );
    expect(expand).toContain('CREATE INDEX "idx_caminhoes_frota"');
    expect(expand).toContain('CONSTRAINT "chk_carga_itens_divergencia_motivo"');
    expect(expand).toContain('DROP CONSTRAINT "chk_carga_itens_status"');
    expect(expand).toContain(
      'ADD CONSTRAINT "chk_carga_itens_status" CHECK ("carga_itens"."status_carga_item" IN (\'em_carga\',\'conferido\',\'divergente\',\'removido\'));',
    );
    expect(expand).not.toMatch(/^\s*(UPDATE|INSERT|DELETE|TRUNCATE)\b/im);
  });

  it('journal contíguo: 0023 (Onda 7) → 0024 (Onda 9), sem gap', () => {
    const journal = readJson<Journal>(path.join(META_DIR, '_journal.json'));
    const entries = journal.entries.filter((entry) => entry.idx >= 23 && entry.idx <= 24);

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(entries.map(({ idx, tag }) => ({ idx, tag }))).toEqual([
      { idx: 23, tag: '0023_onda7_desossa_expand' },
      { idx: 24, tag: '0024_onda9_carga_expand' },
    ]);
    expect(entries.every((entry) =>
      entry.version === '7' && entry.breakpoints,
    )).toBe(true);

    const snapshots = [23, 24].map((idx) =>
      readJson<Snapshot>(
        path.join(META_DIR, `${String(idx).padStart(4, '0')}_snapshot.json`),
      ),
    );
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(new Set(snapshots.map((snapshot) => snapshot.id)).size).toBe(2);
    expect(snapshots.every((snapshot) =>
      uuid.test(snapshot.id) &&
      snapshot.version === '7' &&
      snapshot.dialect === 'postgresql',
    )).toBe(true);
    expect(snapshots[1]!.prevId).toBe(snapshots[0]!.id);

    const actualO9 = fs.readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^0024_/.test(name));
    expect(new Set(actualO9)).toEqual(new Set(['0024_onda9_carga_expand.sql']));
  });
});
