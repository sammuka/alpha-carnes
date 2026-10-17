/** Achado recorrente: padrão LIKE `%${termo}%` sem escapar % _ \ do usuário. Use src/common/sql/ilike-seguro.ts. */
import { ehTeste, executarSeDireto } from './lint-lib.mjs';

export const regra = {
  ids: ['ilike-sem-escape'],
  alvo: (rel) => /^app\/backend\/src\/.*\.ts$/.test(rel) && !ehTeste(rel) && rel !== 'app/backend/src/common/sql/ilike-seguro.ts',
  verificar: (rel, texto) =>
    texto.split(/\r?\n/).flatMap((l, i) =>
      /`[^`]*%\$\{/.test(l)
        ? [{ arquivo: rel, linha: i + 1, regra: 'ilike-sem-escape', mensagem: 'padrão LIKE com `%${...}` sem escape: use ilikeSeguro/padraoContem de src/common/sql/ilike-seguro.ts' }]
        : []),
};

executarSeDireto(import.meta.url, [regra]);
