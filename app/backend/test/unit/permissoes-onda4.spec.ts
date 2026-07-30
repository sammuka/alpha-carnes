import { DESCRICOES_PERMISSOES, MAPA_PERFIL_PERMISSOES, PERMISSOES } from '../../src/common/rbac/permissoes';

describe('Onda 4 — permissões de tabela de preços, espelho e liberação de reserva', () => {
  it('perfis recebem as quatro permissoes novas da onda 4', () => {
    expect(MAPA_PERFIL_PERMISSOES.gestor).toEqual(expect.arrayContaining([
      PERMISSOES.TABELA_PRECO_LER, PERMISSOES.TABELA_PRECO_GERENCIAR,
      PERMISSOES.ESPELHO_COMERCIAL_LER, PERMISSOES.PEDIDO_RESERVA_LIBERAR,
    ]));
    expect(MAPA_PERFIL_PERMISSOES.comercial).toEqual(expect.arrayContaining([
      PERMISSOES.TABELA_PRECO_LER, PERMISSOES.ESPELHO_COMERCIAL_LER,
    ]));
    expect(MAPA_PERFIL_PERMISSOES.comercial).not.toContain(PERMISSOES.PEDIDO_RESERVA_LIBERAR);
    expect(MAPA_PERFIL_PERMISSOES.expedicao).toContain(PERMISSOES.ESPELHO_COMERCIAL_LER);
    // DESCRICOES_PERMISSOES é Record<Permissao, string>: sem descrição, o type-check quebra.
    for (const chave of [
      PERMISSOES.TABELA_PRECO_LER, PERMISSOES.TABELA_PRECO_GERENCIAR,
      PERMISSOES.ESPELHO_COMERCIAL_LER, PERMISSOES.PEDIDO_RESERVA_LIBERAR,
    ]) {
      expect(DESCRICOES_PERMISSOES[chave]).toEqual(expect.any(String));
    }
  });
});
