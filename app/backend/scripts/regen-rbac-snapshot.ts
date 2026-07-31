import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAPA_PERFIL_PERMISSOES } from '../src/common/rbac/permissoes';

const out: Record<string, string[]> = {};
for (const [perfil, perms] of Object.entries(MAPA_PERFIL_PERMISSOES)) {
  out[perfil] = [...new Set(perms)].sort();
}
const caminho = join(__dirname, '../src/common/rbac/perfil-permissoes.snapshot.json');
writeFileSync(caminho, `${JSON.stringify(out, null, 2)}\n`);
console.log('OK snapshot regenerado');
for (const p of ['comercial', 'diretoria'] as const) {
  if (!out[p].includes('DESOSSA_LER') || !out[p].includes('DESOSSA_PAINEL_LER')) {
    console.error('FAIL', p);
    process.exit(1);
  }
}
console.log('OK comercial+diretoria DESOSSA_LER+DESOSSA_PAINEL_LER');
