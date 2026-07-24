import {
  PERMISSOES,
  DESCRICOES_PERMISSOES,
} from '../../src/common/rbac/permissoes';

const CHAVES_ONDA1 = [
  'OPERACOES_GERENCIAR',
  'PEDIDO_OVERBOOKING_CONFIRMAR',
  'OVERBOOKING_RESOLVER',
  'PEDIDO_FORNECEDOR_GERENCIAR',
  'CONFERENCIA_CONCLUIR',
  'PEDIDO_FINALIZAR',
] as const;

describe('permissoes-onda1', () => {
  it('PERMISSOES contém as 6 chaves da Onda 1 com valor idêntico à chave', () => {
    for (const chave of CHAVES_ONDA1) {
      expect(PERMISSOES[chave]).toBe(chave);
    }
  });

  it('toda chave de PERMISSOES tem descrição e vice-versa (Record exaustivo)', () => {
    const chavesPermissoes = Object.values(PERMISSOES).sort();
    const chavesDescricoes = Object.keys(DESCRICOES_PERMISSOES).sort();
    expect(chavesDescricoes).toEqual(chavesPermissoes);
    for (const chave of CHAVES_ONDA1) {
      expect(DESCRICOES_PERMISSOES[chave]).toMatch(/\S/);
    }
  });
});
