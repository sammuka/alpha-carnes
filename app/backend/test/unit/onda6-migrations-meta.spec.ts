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

describe('Onda 6 — proveniência das migrations D6.13', () => {
  it('separa ddl gerado de sql custom de backfill', () => {
    const expand = readMigration('0021_onda6_recebimento_balanca_expand');
    const backfill = readMigration('0022_onda6_etiqueta_estado_backfill');

    expect(expand).toContain('CREATE TABLE "trocas_peca"');
    expect(expand).toContain(
      'ALTER TABLE "etiquetas_impressoes" ADD COLUMN "estado" text DEFAULT \'emitida\' NOT NULL',
    );
    expect(expand).toContain(
      'ALTER TABLE "etiquetas_impressoes" ADD COLUMN "motivo_cancelamento" text',
    );
    expect(expand).toContain(
      'ALTER TABLE "etiquetas_impressoes" ADD COLUMN "invalidada_em" timestamp with time zone',
    );
    expect(expand).toContain(
      'ALTER TABLE "etiquetas_impressoes" ADD COLUMN "invalidada_por_id" uuid',
    );
    expect(expand).toContain('CONSTRAINT "chk_etiq_estado"');
    expect(expand).toContain('CONSTRAINT "chk_etiq_cancelada_motivo"');
    expect(expand).toContain('CREATE INDEX "idx_etiq_estado"');
    expect(expand).toContain('DROP CONSTRAINT "chk_assoc_hist_acao"');
    expect(expand).toContain('ADD CONSTRAINT "chk_assoc_hist_acao"');
    expect(expand).toContain('DROP CONSTRAINT "chk_aprovacao_tipo"');
    expect(expand).toContain('pendencia_fisica_etiqueta');
    expect(expand).not.toMatch(/^\s*(UPDATE|INSERT|DELETE|TRUNCATE)\b/im);

    expect(backfill).toMatch(/^UPDATE "etiquetas_impressoes"/m);
    expect(backfill).toContain("SET \"estado\" = 'reimpressa'");
    expect(backfill).toContain("SET \"estado\" = 'ativa'");
    expect(backfill).toContain('RAISE EXCEPTION \'backfill incompleto:');
    expect(backfill).not.toMatch(/^\s*(CREATE|ALTER|DROP|TRUNCATE)\b/im);
  });

  it('encadeia journal e snapshots gerados de 0020 a 0022', () => {
    const journal = readJson<Journal>(path.join(META_DIR, '_journal.json'));
    // Emenda 7: O7 adiciona idx 23 — meta O6 isola 20..22 (não quebrar com 0023)
    const entries = journal.entries.filter((entry) => entry.idx >= 20 && entry.idx <= 22);

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(entries.map(({ idx, tag }) => ({ idx, tag }))).toEqual([
      { idx: 20, tag: '0020_onda5_usuarios_representantes' },
      { idx: 21, tag: '0021_onda6_recebimento_balanca_expand' },
      { idx: 22, tag: '0022_onda6_etiqueta_estado_backfill' },
    ]);
    expect(entries.every((entry) =>
      entry.version === '7' && entry.breakpoints,
    )).toBe(true);

    const snapshots = [20, 21, 22].map((idx) =>
      readJson<Snapshot>(
        path.join(META_DIR, `${String(idx).padStart(4, '0')}_snapshot.json`),
      ),
    );
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(new Set(snapshots.map((snapshot) => snapshot.id)).size).toBe(3);
    expect(snapshots.every((snapshot) =>
      uuid.test(snapshot.id) &&
      snapshot.version === '7' &&
      snapshot.dialect === 'postgresql',
    )).toBe(true);
    expect(snapshots[1]!.prevId).toBe(snapshots[0]!.id);
    expect(snapshots[2]!.prevId).toBe(snapshots[1]!.id);

    const expectedO6 = new Set([
      '0021_onda6_recebimento_balanca_expand.sql',
      '0022_onda6_etiqueta_estado_backfill.sql',
    ]);
    const actualO6 = fs.readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^002[12]_/.test(name));
    expect(new Set(actualO6)).toEqual(expectedO6);
  });
});
