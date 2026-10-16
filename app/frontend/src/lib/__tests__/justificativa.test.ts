import { normalizarJustificativa } from '../justificativa';

describe('normalizarJustificativa', () => {
  it.each([
    ['3xU+2060', '⁠⁠⁠'],
    ['U+00AD', '­­­'],
    ['U+200E', '‎‎‎'],
    ['U+180E', '᠎᠎᠎'],
    ['U+2800', '⠀⠀⠀'],
    ['U+034F', '͏͏͏'],
    ['U+3000', '　　　'],
    ['NBSP', '   '],
    ['U+200B', '​​​'],
    ['só espaços', '     '],
  ])('%s vira texto vazio', (_n, texto) => {
    expect(normalizarJustificativa(texto)).toBe('');
  });

  it('preserva acentos combinantes e emoji', () => {
    expect(normalizarJustificativa('  Correção \u{1F600}  ')).toBe('Correção \u{1F600}');
    expect(normalizarJustificativa('é')).toBe('é');
  });
});
