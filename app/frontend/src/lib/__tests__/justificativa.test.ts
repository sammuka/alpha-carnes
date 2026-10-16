import { justificativaValida, normalizarJustificativa } from '../justificativa';

const c = (...pontos: number[]) => String.fromCodePoint(...pontos);
const rep = (pontos: number[], n = 3) => c(...pontos).repeat(n);

describe('normalizarJustificativa e justificativaValida', () => {
  it.each([
    ['U+17B4', rep([0x17b4])],
    ['U+FE0F', rep([0xfe0f])],
    ['U+180B-180D', c(0x180b, 0x180c, 0x180d)],
    ['U+E0100-E0102', c(0xe0100, 0xe0101, 0xe0102)],
    ['U+0301 soltos', rep([0x301])],
    ['viramas e nuktas soltos', c(0x94d, 0x93c, 0x94d, 0x9cd)],
    ['U+2060', rep([0x2060])],
    ['U+00AD', rep([0xad])],
    ['U+200E', rep([0x200e])],
    ['U+180E', rep([0x180e])],
    ['U+2800', rep([0x2800])],
    ['U+034F', rep([0x34f])],
    ['U+3000', rep([0x3000])],
    ['NBSP', rep([0xa0])],
    ['U+200B', rep([0x200b])],
    ['só espaços', '     '],
  ])('%s é recusada', (_n, texto) => {
    expect(justificativaValida(texto)).toBe(false);
  });

  it('apara invisíveis e espaços apenas nas pontas', () => {
    expect(normalizarJustificativa(c(0x200b, 0x20) + 'abc' + c(0xa0, 0x2060))).toBe('abc');
  });

  it.each([
    ['família com ZWJ', c(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467) + ' ok'],
    ['persa com ZWNJ', 'می' + c(0x200c) + 'خواهم'],
    ['bandeira com tags', c(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f) + ' abc'],
    ['acento composto', 'S' + c(0x61, 0x303) + 'o Jose' + c(0x301)],
    ['pré-composto', 'São José'],
    ['ação', 'ação'],
  ])('%s é aceita e gravada intacta', (_n, texto) => {
    expect(justificativaValida(texto)).toBe(true);
    expect(normalizarJustificativa(` ${texto}${c(0x200b)}`)).toBe(texto);
  });
});
