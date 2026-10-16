import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS = path.resolve(__dirname, '../../src/database/migrations');
const META = path.join(MIGRATIONS, 'meta');

type Journal = { entries: { idx: number; tag: string }[] };
type Snapshot = { id: string; prevId: string };

const ler = <T>(arquivo: string): T => JSON.parse(fs.readFileSync(arquivo, 'utf8')) as T;

describe('E09-T02: migration das políticas de contabilização', () => {
  const journal = ler<Journal>(path.join(META, '_journal.json'));
  const politica = journal.entries.filter((entrada) => entrada.tag.includes('e09_t02'));
  const plano = journal.entries.filter((entrada) => entrada.tag.includes('e09_t01'));

  it('tem uma única entrada, com a tag 0050, logo depois da T01', () => {
    expect(politica).toHaveLength(1);
    expect(politica[0]?.tag).toBe('0050_e09_t02_politicas_contabilizacao');
    expect(plano).toHaveLength(1);
    expect(plano[0]?.tag.startsWith('0049_')).toBe(true);
    expect(politica[0]!.idx).toBe(plano[0]!.idx + 1);
  });

  it('os arquivos existem com o prefixo novo e o antigo sumiu', () => {
    expect(fs.existsSync(path.join(MIGRATIONS, '0050_e09_t02_politicas_contabilizacao.sql'))).toBe(true);
    expect(fs.existsSync(path.join(META, '0050_snapshot.json'))).toBe(true);
    expect(fs.existsSync(path.join(MIGRATIONS, '0049_e09_t02_politicas_contabilizacao.sql'))).toBe(false);
  });

  it('o snapshot 0050 encadeia no snapshot 0049 da T01', () => {
    const t01 = ler<Snapshot>(path.join(META, '0049_snapshot.json'));
    const t02 = ler<Snapshot>(path.join(META, '0050_snapshot.json'));
    expect(t02.prevId).toBe(t01.id);
  });

  it('cria só as três tabelas da política', () => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, '0050_e09_t02_politicas_contabilizacao.sql'), 'utf8');
    const criadas = [...sql.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]).sort();
    expect(criadas).toEqual(['politica_simulacoes', 'politica_versoes', 'politicas_contabilizacao']);
  });
});
