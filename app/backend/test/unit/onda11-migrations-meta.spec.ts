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

describe('Onda 11 — proveniência das migrations expand/backfill/contract', () => {
  it('encadeia journal e snapshots gerados de 0027 a 0030', () => {
    const journal = readJson<Journal>(path.join(META_DIR, '_journal.json'));
    const entries = journal.entries.filter(
      (entry) => entry.idx >= 27 && entry.idx <= 30,
    );

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(entries.map(({ idx, tag }) => ({ idx, tag }))).toEqual([
      { idx: 27, tag: '0027_onda_frota_dados_legado' },
      { idx: 28, tag: '0028_onda11_multicompra_expand' },
      { idx: 29, tag: '0029_onda11_multicompra_backfill' },
      { idx: 30, tag: '0030_onda11_multicompra_contract' },
    ]);
    expect(entries.every((entry) =>
      entry.version === '7' && entry.breakpoints,
    )).toBe(true);

    const snapshots = [27, 28, 29, 30].map((idx) =>
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

    const expectedO11 = new Set([
      '0028_onda11_multicompra_expand.sql',
      '0029_onda11_multicompra_backfill.sql',
      '0030_onda11_multicompra_contract.sql',
    ]);
    const actualO11 = fs.readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^002[89]_|0030_/.test(name));
    expect(new Set(actualO11)).toEqual(expectedO11);
  });

  it('separa ddl gerado de sql custom preservador', () => {
    const expand = readMigration('0028_onda11_multicompra_expand');
    const backfill = readMigration('0029_onda11_multicompra_backfill');
    const contract = readMigration('0030_onda11_multicompra_contract');

    expect(expand).toContain('uq_compras_prog_operacao');
    expect(expand).toMatch(/DROP INDEX/i);
    expect(expand).toContain('numero_sequencial');
    expect(expand).toContain(
      'ALTER TABLE "pedidos_venda" ALTER COLUMN "compra_programada_id" DROP NOT NULL',
    );
    expect(expand).toContain('compra_programada_origem_id');
    expect(expand).toContain('recebimento_origem_id');
    expect(expand).not.toMatch(
      /ALTER TABLE "pecas" ALTER COLUMN "compra_programada_id" DROP NOT NULL/,
    );
    expect(expand).not.toMatch(
      /"numero_sequencial".*NOT NULL|"compra_programada_origem_id".*NOT NULL|"recebimento_origem_id".*NOT NULL/,
    );
    expect(expand).not.toMatch(/^\s*(UPDATE|INSERT|DELETE|TRUNCATE)\b/im);

    expect(backfill).toMatch(
      /row_number\(\)\s+OVER\s*\(\s*PARTITION BY operacao_id\s+ORDER BY created_at,\s*id/i,
    );
    expect(backfill).not.toMatch(/^\s*(CREATE|ALTER|DROP|TRUNCATE)\b/im);

    expect(contract).toMatch(
      /ALTER TABLE "compras_programadas" ALTER COLUMN "numero_sequencial" SET NOT NULL/,
    );
    expect(contract).toMatch(
      /ALTER TABLE "associacoes_peca_historico" ALTER COLUMN "compra_programada_origem_id" SET NOT NULL/,
    );
    expect(contract).toMatch(
      /ALTER TABLE "associacoes_peca_historico" ALTER COLUMN "recebimento_origem_id" SET NOT NULL/,
    );
    expect(contract).toContain('uq_compras_prog_operacao_sequencial');
    expect(contract).toContain('pecas_impedir_mutacao_compra_programada');
    expect(contract).toContain('trg_pecas_compra_programada_imutavel');
    expect(contract).toContain(
      'pecas.compra_programada_id is immutable (AD-14)',
    );
  });
});
