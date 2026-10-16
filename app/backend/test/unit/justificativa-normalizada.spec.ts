import { justificativaSchema as schemaT01 } from '../../src/modules/erp/fiscal/empresas/dto/comum.dto';
import { justificativaSchema as schemaT02 } from '../../src/modules/erp/fiscal/enquadramentos/dto/comum.dto';

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

  it('aceita acentos e emoji, preservando marcas combinantes', () => {
    expect(schema.parse('  Correção ação \u{1F600}  ')).toBe('Correção ação \u{1F600}');
    expect(schema.parse('e\u0301e\u0301e\u0301')).toBe('e\u0301e\u0301e\u0301');
  });
});
