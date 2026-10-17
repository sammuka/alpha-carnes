/** Achado recorrente: CSV montado à mão sem escape de fórmula/BOM. Use app/backend/src/common/csv.ts. */
import { ehTeste, executarSeDireto } from './lint-lib.mjs';

export const regra = {
  ids: ['csv-manual'],
  alvo: (rel) => /^app\/backend\/src\/.*\.ts$/.test(rel) && !ehTeste(rel) && rel !== 'app/backend/src/common/csv.ts',
  verificar: (rel, texto) =>
    texto.split(/\r?\n/).flatMap((l, i) =>
      /\.join\(\s*['"`];['"`]\s*\)/.test(l)
        ? [{ arquivo: rel, linha: i + 1, regra: 'csv-manual', mensagem: "CSV com join(';') manual: use montarCsv/celulaCsv de src/common/csv.ts" }]
        : []),
};

executarSeDireto(import.meta.url, [regra]);
