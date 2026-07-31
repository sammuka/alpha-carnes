import {
  PERMISSOES,
  DESCRICOES_PERMISSOES,
} from '../../src/common/rbac/permissoes';

const CHAVES_ONDA5 = [
  'SIF_LER',
  'SIF_GERAR',
  'APROVACOES_LER',
  'APROVACOES_DECIDIR',
  'APROVACOES_SOLICITAR',
] as const;

describe('permissoes-onda5', () => {
  it('PERMISSOES contém as 5 chaves da Onda 5 com valor idêntico à chave', () => {
    for (const chave of CHAVES_ONDA5) {
      expect(PERMISSOES[chave]).toBe(chave);
    }
  });

  it('toda chave de PERMISSOES tem descrição e vice-versa (Record exaustivo)', () => {
    const chavesPermissoes = Object.values(PERMISSOES).sort();
    const chavesDescricoes = Object.keys(DESCRICOES_PERMISSOES).sort();
    expect(chavesDescricoes).toEqual(chavesPermissoes);
    for (const chave of CHAVES_ONDA5) {
      expect(DESCRICOES_PERMISSOES[chave]).toMatch(/\S/);
    }
  });
});
