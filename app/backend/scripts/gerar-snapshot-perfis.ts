import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAPA_PERFIL_PERMISSOES } from '../src/common/rbac/permissoes';

const snapshot = Object.fromEntries(
  Object.entries(MAPA_PERFIL_PERMISSOES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([perfil, permissoes]) => [perfil, [...new Set(permissoes)].sort()]),
);

const destino = join(__dirname, '..', 'src', 'common', 'rbac', 'perfil-permissoes.snapshot.json');
writeFileSync(destino, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
process.stdout.write(`snapshot gravado: ${destino}\n`);
