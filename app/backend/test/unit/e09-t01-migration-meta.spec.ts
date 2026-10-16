import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const MIGRATIONS = path.resolve(__dirname, '../../src/database/migrations');
const META = path.join(MIGRATIONS, 'meta');

interface Journal { entries: { idx: number; tag: string }[] }

describe('migration do plano de contas (E09-T01)', () => {
  const journal = JSON.parse(readFileSync(path.join(META, '_journal.json'), 'utf8')) as Journal;

  it('o journal tem a tag 0049_e09_t01_plano_contas uma única vez e nenhuma 0048_e09', () => {
    const tags = journal.entries.map((e) => e.tag);
    expect(tags.filter((t) => t === '0049_e09_t01_plano_contas')).toHaveLength(1);
    expect(tags.some((t) => t.startsWith('0048_e09'))).toBe(false);
    expect(tags).toContain('0048_e01_t05_homologacoes_regras');
  });

  it('idx do journal é crescente e sem repetição, e a tag 0049 está no idx 49 seguida só de ordinais maiores', () => {
    const idxs = journal.entries.map((e) => e.idx);
    expect(idxs).toEqual([...new Set(idxs)].sort((a, b) => a - b));
    const posicao = journal.entries.findIndex((e) => e.tag === '0049_e09_t01_plano_contas');
    expect(journal.entries[posicao]?.idx).toBe(49);
    for (const posterior of journal.entries.slice(posicao + 1)) {
      expect(Number(posterior.tag.slice(0, 4))).toBeGreaterThan(49);
    }
  });

  it('arquivos coincidem com a tag e o SQL mantém tabelas e triggers', () => {
    expect(readdirSync(MIGRATIONS).some((f) => f.startsWith('0048_e09'))).toBe(false);
    expect(existsSync(path.join(META, '0049_snapshot.json'))).toBe(true);
    const sql = readFileSync(path.join(MIGRATIONS, '0049_e09_t01_plano_contas.sql'), 'utf8');
    for (const tabela of ['centros_custo', 'contas_contabeis', 'conta_versoes']) {
      expect(sql).toContain(`CREATE TABLE "${tabela}"`);
      expect(sql).toContain(`CREATE TRIGGER trg_${tabela}_updated_at`);
    }
  });

  it('cada CREATE TRIGGER é precedido pela linha --> statement-breakpoint', () => {
    const sql = readFileSync(path.join(MIGRATIONS, '0049_e09_t01_plano_contas.sql'), 'utf8');
    expect(sql.match(/CREATE TRIGGER/g)).toHaveLength(3);
    expect(sql.match(/-->\s*statement-breakpoint\r?\nCREATE TRIGGER/g)).toHaveLength(3);
  });
});
