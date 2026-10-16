import { justificativaSchema as schemaT01 } from '../../src/modules/erp/fiscal/empresas/dto/comum.dto';
import { justificativaSchema as schemaT02 } from '../../src/modules/erp/fiscal/enquadramentos/dto/comum.dto';
import { contarVisiveis, normalizarJustificativa } from '../../src/common/validators/justificativa';

const rep = (c: string) => c.repeat(3);
const INVISIVEIS: Record<string, string> = {
  '3xU+2060': rep('\u2060'),
  'U+00AD': rep('\u00AD'),
  'U+200E': rep('\u200E'),
  'U+180E': rep('\u180E'),
  'U+2800': rep('\u2800'),
  'U+034F': rep('\u034F'),
  'U+3000': rep('\u3000'),
  NBSP: rep('\u00A0'),
  'U+200B': rep('\u200B'),
  'U+3164': rep('\u3164'),
  'só espaços': '     ',
};

describe.each([
  ['T01 (empresas)', schemaT01],
  ['T02 (enquadramentos)', schemaT02],
])('justificativa normalizada - %s', (_nome, schema) => {
  it.each(Object.entries(INVISIVEIS))('recusa %s', (_k, texto) => {
    expect(schema.safeParse(texto).success).toBe(false);
  });

  it('recusa quando invisíveis completam só parte do mínimo', () => {
    expect(schema.safeParse('ab\u2060\u00AD ').success).toBe(false);
  });

  it('aceita acentos e emoji, preservando acentos combinantes', () => {
    expect(schema.parse('  Correção ação \u{1F600}  ')).toBe('Correção ação \u{1F600}');
    expect(schema.parse('e\u0301e\u0301e\u0301')).toBe('e\u0301e\u0301e\u0301');
  });
});
const c = (...pontos: number[]) => String.fromCodePoint(...pontos);

describe('emoji com tags e contagem por grafema', () => {
  const flag = c(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
  const familia = c(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);

  it('preserva as tags que seguem emoji no fim, mas apara tags soltas', () => {
    expect(normalizarJustificativa(`abc ${flag} ${c(0x200b)}`)).toBe(`abc ${flag}`);
    expect(normalizarJustificativa(`abc${c(0x1f3f4, 0xfe0f, 0xe0067, 0xe007f)}`)).toBe(`abc${c(0x1f3f4, 0xfe0f, 0xe0067, 0xe007f)}`);
    expect(normalizarJustificativa(`abc${c(0xe0067, 0xe007f)}`)).toBe('abc');
    expect(normalizarJustificativa(`ab${c(0xe0067)}`)).toBe('ab');
  });

  it('conta por grafema e ignora brancos visuais', () => {
    expect(contarVisiveis(c(0x3164, 0x3164, 0x3164))).toBe(0);
    expect(contarVisiveis(c(0x2800, 0x115f, 0x1160, 0xffa0, 0x34f))).toBe(0);
    expect(contarVisiveis(familia)).toBe(1);
    expect(contarVisiveis(flag)).toBe(1);
    expect(contarVisiveis(c(0x65, 0x301))).toBe(1);
    expect(contarVisiveis(`a${familia}b`) >= 3).toBe(true);
    expect(contarVisiveis(`${familia}${familia}`) >= 3).toBe(false);
  });
});
