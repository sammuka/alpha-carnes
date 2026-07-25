import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAPA_PERFIL_PERMISSOES } from '../../src/common/rbac/permissoes';

const CAMINHO = join(__dirname, '..', '..', 'src', 'common', 'rbac', 'perfil-permissoes.snapshot.json');

describe('snapshot perfil → permissões', () => {
  const snapshot = JSON.parse(readFileSync(CAMINHO, 'utf8')) as Record<string, string[]>;

  it('cobre os 11 perfis canonicos', () => {
    expect(Object.keys(snapshot).sort()).toEqual(Object.keys(MAPA_PERFIL_PERMISSOES).sort());
    expect(Object.keys(snapshot)).toHaveLength(11);
  });

  it('snapshot reflete exatamente MAPA_PERFIL_PERMISSOES', () => {
    for (const [perfil, permissoes] of Object.entries(MAPA_PERFIL_PERMISSOES)) {
      expect(snapshot[perfil]).toEqual([...new Set(permissoes)].sort());
    }
  });
});
