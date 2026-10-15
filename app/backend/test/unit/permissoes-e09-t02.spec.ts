import { MAPA_PERFIL_PERMISSOES, PERMISSOES } from '../../src/common/rbac/permissoes';
import { MENUS_VISIVEIS_POR_PERFIL } from '../../src/common/rbac/menus-canonicos';

const ROTA = '/erp/contabilidade/politicas-de-contabilizacao';
const CHAVES = [PERMISSOES.CONTABILIDADE_POLITICA_LER, PERMISSOES.CONTABILIDADE_POLITICA_GERENCIAR];

describe('E09-T02 RBAC', () => {
  it('concede as duas permissões só ao administrador', () => {
    expect(MAPA_PERFIL_PERMISSOES.administrador).toEqual(expect.arrayContaining(CHAVES));
    for (const [slug, lista] of Object.entries(MAPA_PERFIL_PERMISSOES)) {
      if (slug === 'administrador') continue;
      for (const chave of CHAVES) expect(lista).not.toContain(chave);
    }
  });

  it('põe a rota só no menu do administrador e não mexe no gestor', () => {
    expect(MENUS_VISIVEIS_POR_PERFIL.administrador).toContain(ROTA);
    expect(MENUS_VISIVEIS_POR_PERFIL.gestor).not.toContain(ROTA);
    for (const [slug, menus] of Object.entries(MENUS_VISIVEIS_POR_PERFIL)) {
      if (slug === 'administrador') continue;
      expect(menus).not.toContain(ROTA);
    }
  });
});
