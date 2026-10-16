import * as fs from 'node:fs';
import * as path from 'node:path';
import * as lib from '../src/lib/fiscal-homologacoes';

describe('fiscal-homologacoes lib', () => {
  it('não exporta cálculo de tributo', () => {
    expect(lib).not.toHaveProperty('calcularMemoria');
    expect(lib).not.toHaveProperty('calcular');
    expect(lib.TEXTO_VAZIO).toContain('Nenhum resultado');
    const fonte = fs.readFileSync(path.join(__dirname, '../src/lib/fiscal-homologacoes.ts'), 'utf8');
    expect(fonte).not.toMatch(/parseFloat/);
    expect(fonte).not.toMatch(/Number\(/);
  });
});

describe('responsável pela aprovação (D4)', () => {
  it('"Pendente" só em Em revisão; Rejeitada e Publicada sem aprovador ficam vazias', () => {
    expect(lib.rotuloAprovador({ situacao: 'Em revisão', aprovador: '' })).toBe('Pendente');
    expect(lib.rotuloAprovador({ situacao: 'Rejeitada', aprovador: '' })).toBe('');
    expect(lib.rotuloAprovador({ situacao: 'Publicada', aprovador: '' })).toBe('');
    expect(lib.rotuloAprovador({ situacao: 'Aprovada', aprovador: 'Carlos Lima' })).toBe('Carlos Lima');
  });
});
