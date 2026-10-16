import { listarHomologacoesSchema } from '../../src/modules/erp/fiscal/homologacoes/dto/homologacao.dto';
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
