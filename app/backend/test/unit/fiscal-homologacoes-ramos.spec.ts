import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('fiscal-homologacoes ramos', () => {
  const fonte = readFileSync(join('src/modules/erp/fiscal/homologacoes/homologacoes.service.ts'), 'utf8').replace(/\r\n/g, '\n');

  it('não importa nota fiscal', () => {
    expect(fonte).not.toMatch(/notas_fiscais/);
  });

  it('emite só depois da transação', () => {
    const callbacks = [...fonte.matchAll(/this\.db\.transaction\(async \(tx\) => \{([\s\S]*?)\n    \}\);/g)];
    expect(callbacks.length).toBeGreaterThan(0);
    for (const callback of callbacks) {
      expect(callback[1]).not.toContain('this.eventos.emit');
    }
    expect(fonte).toMatch(/await this\.db\.transaction\([\s\S]*?\n    \}\);\n    this\.eventos\.emit\(/);
  });
});
