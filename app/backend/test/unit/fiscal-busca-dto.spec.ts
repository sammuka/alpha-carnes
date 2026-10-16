import { justificativaSchema } from '../../src/modules/erp/fiscal/enquadramentos/dto/comum.dto';
import { criarHomologacaoSchema, listarHomologacoesSchema } from '../../src/modules/erp/fiscal/homologacoes/dto/homologacao.dto';
import { listarCatalogoQuerySchema } from '../../src/modules/erp/fiscal/regras/dto/comum.dto';
import { listarRegrasSchema } from '../../src/modules/erp/fiscal/regras/dto/regra.dto';
import { listarSimulacoesSchema } from '../../src/modules/erp/fiscal/simulacoes/dto/simulacao.dto';

const UUID = '0199e1a0-0000-7000-8000-000000000001';

describe('busca livre das listagens fiscais', () => {
  it.each([
    ['homologações', listarHomologacoesSchema],
    ['simulações', listarSimulacoesSchema],
    ['regras', listarRegrasSchema],
    ['catálogos', listarCatalogoQuerySchema],
  ] as const)('search com caractere nulo é recusado em %s', (_nome, schema) => {
    expect(schema.safeParse({ search: 'a\u0000b' }).success).toBe(false);
    expect(schema.safeParse({ search: 'abc' }).success).toBe(true);
  });

  it('simulações filtra por código da linhagem e por versão da regra', () => {
    const ok = listarSimulacoesSchema.safeParse({ codigo: '12', regraId: UUID });
    expect(ok.success).toBe(true);
    expect(listarSimulacoesSchema.safeParse({ codigo: 'a\u0000b' }).success).toBe(false);
    expect(listarSimulacoesSchema.safeParse({ regraId: 'x' }).success).toBe(false);
  });

  it('regras filtra por código da linhagem e por situação', () => {
    expect(listarRegrasSchema.safeParse({ codigo: '7', situacao: 'APROVADA' }).success).toBe(true);
    expect(listarRegrasSchema.safeParse({ situacao: 'QUALQUER' }).success).toBe(false);
    expect(listarRegrasSchema.safeParse({ codigo: 'a\u0000b' }).success).toBe(false);
  });
});

describe('justificativa e descrição medidas sem caracteres invisíveis', () => {
  it('largura zero e BOM não contam para o mínimo de 3 caracteres', () => {
    expect(justificativaSchema.safeParse('a\u200Bb\u200C\u200D\uFEFF').success).toBe(false);
    expect(justificativaSchema.safeParse('\u200B\u200B\u200B\u200B').success).toBe(false);
    const ok = justificativaSchema.safeParse(' a\u200Bbc ');
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toBe('a\u200Bbc');
  });

  it('a descrição da homologação segue a mesma regra', () => {
    const base = { regraId: UUID, justificativa: 'Motivo da revisão' };
    expect(criarHomologacaoSchema.safeParse({ ...base, descricao: 'a\u200Bb' }).success).toBe(false);
    expect(criarHomologacaoSchema.safeParse({ ...base, descricao: 'ab\u200Bc' }).success).toBe(true);
    expect(criarHomologacaoSchema.safeParse({ ...base, descricao: 'abc', justificativa: '\u200B\u200B\u200B' }).success).toBe(false);
  });
});

describe('normalizador único das justificativas e da descrição', () => {
  const INVISIVEIS = ['\u2060', '\u00AD', '\u200E', '\u180E', '\u2800', '\u034F', '\u3164', '\uFFA0'];

  it.each(INVISIVEIS)('três %s não formam uma justificativa nem uma descrição', (caractere) => {
    const tres = caractere.repeat(3);
    expect(justificativaSchema.safeParse(tres).success).toBe(false);
    expect(criarHomologacaoSchema.safeParse({ regraId: UUID, justificativa: 'Motivo da revisão', descricao: tres }).success).toBe(false);
  });

  it('acentos e emoji seguem aceitos e o valor gravado sai normalizado', () => {
    const ok = criarHomologacaoSchema.safeParse({ regraId: UUID, justificativa: ' Revisão \u2060concluída ', descricao: 'Ação \u200Bde teste' });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.justificativa).toBe('Revisão \u2060concluída');
      expect(ok.data.descricao).toBe('Ação \u200Bde teste');
    }
  });
});
