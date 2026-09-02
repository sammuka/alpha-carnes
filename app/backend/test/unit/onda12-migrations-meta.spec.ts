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

describe('Onda 12 — proveniência das migrations expand/backfill/contract', () => {
  it('DoD 12.13c journal 0031 0032 0033 corresponde aos snapshots', () => {
    const journal = readJson<Journal>(path.join(META_DIR, '_journal.json'));
    const entries = journal.entries.filter(
      (entry) => entry.idx >= 30 && entry.idx <= 33,
    );

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(entries.map(({ idx, tag }) => ({ idx, tag }))).toEqual([
      { idx: 30, tag: '0030_onda11_multicompra_contract' },
      { idx: 31, tag: '0031_onda12_dominio_expand' },
      { idx: 32, tag: '0032_onda12_dominio_backfill' },
      { idx: 33, tag: '0033_onda12_dominio_contract' },
    ]);
    expect(entries.every((entry) =>
      entry.version === '7' && entry.breakpoints,
    )).toBe(true);

    const snapshots = [30, 31, 32, 33].map((idx) =>
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

    const expectedO12 = new Set([
      '0031_onda12_dominio_expand.sql',
      '0032_onda12_dominio_backfill.sql',
      '0033_onda12_dominio_contract.sql',
    ]);
    const actualO12 = fs.readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^003[123]_/.test(name));
    expect(new Set(actualO12)).toEqual(expectedO12);
  });

  it('separa ddl gerado de sql custom de domínio', () => {
    const expand = readMigration('0031_onda12_dominio_expand');
    const backfill = readMigration('0032_onda12_dominio_backfill');
    const contract = readMigration('0033_onda12_dominio_contract');

    expect(expand).toContain('representante_padrao_id');
    expect(expand).toContain('caminhao_padrao_id');
    expect(expand).toContain('motorista_padrao_id');
    expect(expand).toContain('rota_id');
    expect(expand).toContain('motorista_id');
    expect(expand).toContain('fornecedor_id');
    expect(expand).not.toMatch(/^\s*(UPDATE|INSERT|DELETE|TRUNCATE)\b/im);

    expect(backfill).toMatch(/lower\(btrim\(unidade_pedido\)\) IN \('kg', 'quilo', 'quilograma'\)/);
    expect(backfill).toMatch(/HAVING count\(DISTINCT/);
    expect(backfill).toContain(
      'Onda 12: unidade histórica fora de kg|unidade; corrigir dado de origem antes do contract',
    );
    expect(backfill).not.toMatch(/^\s*(CREATE|ALTER|DROP|TRUNCATE)\b/im);

    expect(contract).toMatch(/unidade_pedido.*kg.*unidade|IN \('kg',\s*'unidade'\)/);
  });
});
