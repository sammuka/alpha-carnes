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
    when: number;
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

describe('Onda 8 — proveniência da migration 0024 (D8.13)', () => {
  it('0024 é DDL puro: cria as tabelas novas e só adiciona destinar_estoque ao CHECK de acao', () => {
    const expand = readMigration('0024_onda8_estoque_expand');

    expect(expand).toContain('CREATE TABLE "entradas_itens"');
    expect(expand).toContain('CREATE TABLE "ajustes_estoque"');
    expect(expand).toContain('CONSTRAINT "chk_entradas_itens_qtd"');
    expect(expand).toContain('CONSTRAINT "chk_entradas_itens_destinada"');
    expect(expand).toContain('CONSTRAINT "chk_ajustes_um_alvo"');
    expect(expand).toContain('CONSTRAINT "chk_ajustes_delta"');
    expect(expand).toContain('DROP CONSTRAINT "chk_assoc_hist_acao"');
    expect(expand).toContain(
      "ADD CONSTRAINT \"chk_assoc_hist_acao\" CHECK (\"associacoes_peca_historico\".\"acao\" IN ('confirmar','redirecionar','sobra','analise','corte','divergencia','estorno','troca_saida','troca_entrada','destinar_estoque'))",
    );

    // Emenda 1 — herda os 9 valores vigentes (Onda 6), proibido remover.
    for (const valor of [
      'confirmar', 'redirecionar', 'sobra', 'analise', 'corte',
      'divergencia', 'estorno', 'troca_saida', 'troca_entrada', 'destinar_estoque',
    ]) {
      expect(expand).toContain(`'${valor}'`);
    }

    expect(expand).not.toMatch(/^\s*DROP TABLE\b/im);
    expect(expand).not.toMatch(/^\s*DELETE FROM\b/im);
    expect(expand).not.toMatch(/^\s*UPDATE\s/im);
  });

  it('journal contíguo até idx 24 e snapshot 0024 encadeia com 0023', () => {
    const journal = readJson<Journal>(path.join(META_DIR, '_journal.json'));

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(journal.entries.map((e) => e.idx)).toEqual(
      Array.from({ length: journal.entries.length }, (_, i) => i),
    );

    const last = journal.entries[journal.entries.length - 1]!;
    expect(last).toEqual({
      idx: 24,
      version: '7',
      tag: '0024_onda8_estoque_expand',
      when: last.when,
      breakpoints: true,
    });

    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const snap23 = readJson<Snapshot>(path.join(META_DIR, '0023_snapshot.json'));
    const snap24 = readJson<Snapshot>(path.join(META_DIR, '0024_snapshot.json'));

    expect(uuid.test(snap24.id)).toBe(true);
    expect(snap24.version).toBe('7');
    expect(snap24.dialect).toBe('postgresql');
    expect(snap24.prevId).toBe(snap23.id);
  });
});
