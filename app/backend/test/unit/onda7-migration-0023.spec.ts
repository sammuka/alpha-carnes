import * as fs from 'node:fs';
import * as path from 'node:path';

describe('migration 0023 onda7', () => {
  const root = path.join(__dirname, '../../src/database/migrations');
  it('existe SQL 0023 e entrada no journal', () => {
    const sql = fs.readdirSync(root).find((f) => f.startsWith('0023_') && f.endsWith('.sql'));
    expect(sql).toBeTruthy();
    const journal = JSON.parse(
      fs.readFileSync(path.join(root, 'meta/_journal.json'), 'utf8'),
    ) as { entries: { idx: number; tag: string }[] };
    const e = journal.entries.find((x) => x.idx === 23);
    expect(e?.tag).toMatch(/onda7_desossa/);
  });
});
