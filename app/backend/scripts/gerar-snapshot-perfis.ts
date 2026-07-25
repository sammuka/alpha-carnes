import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAPA_PERFIL_PERMISSOES } from '../src/common/rbac/permissoes';
import { MENUS_VISIVEIS_POR_PERFIL } from '../src/common/rbac/menus-canonicos';

const rbac = join(__dirname, '..', 'src', 'common', 'rbac');

const snapshotPermissoes = Object.fromEntries(
  Object.entries(MAPA_PERFIL_PERMISSOES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([perfil, permissoes]) => [perfil, [...new Set(permissoes)].sort()]),
);
const destinoPermissoes = join(rbac, 'perfil-permissoes.snapshot.json');
writeFileSync(destinoPermissoes, `${JSON.stringify(snapshotPermissoes, null, 2)}\n`, 'utf8');
process.stdout.write(`snapshot gravado: ${destinoPermissoes}\n`);

const snapshotMenus = Object.fromEntries(
  Object.entries(MENUS_VISIVEIS_POR_PERFIL)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([perfil, menus]) => [perfil, [...new Set(menus)].sort()]),
);
const destinoMenus = join(rbac, 'perfil-menus.snapshot.json');
writeFileSync(destinoMenus, `${JSON.stringify(snapshotMenus, null, 2)}\n`, 'utf8');
process.stdout.write(`snapshot gravado: ${destinoMenus}\n`);
