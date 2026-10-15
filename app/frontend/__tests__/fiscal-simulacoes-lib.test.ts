import * as fs from 'node:fs';
import * as path from 'node:path';
import * as lib from '../src/lib/fiscal-simulacoes';

describe('fiscal-simulacoes lib', () => {
  it('formata dinheiro e competência sem calcular tributo', () => {
    expect(lib.formatarDinheiroPtBr('583.30')).toBe('583,30');
    expect(lib.rotuloCompetencia('2026-10')).toBe('Outubro de 2026');
    expect(lib).not.toHaveProperty('calcularMemoria');
    const fonte = fs.readFileSync(path.join(__dirname, '../src/lib/fiscal-simulacoes.ts'), 'utf8');
    expect(fonte).not.toMatch(/parseFloat/);
    expect(fonte).not.toMatch(/Number\(/);
  });
});
