import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

const ALVOS = globSync('src/app/(admin)/{cadastros,admin}/**/*.tsx', { cwd: process.cwd() })
  .concat(globSync('src/components/cadastros/**/*.tsx', { cwd: process.cwd() }))
  .concat(['src/lib/menu-v2.ts', 'src/lib/modelos-etiqueta.ts', 'src/lib/frota.ts']);

it('nenhum arquivo da onda usa o rotulo banido pela v1.1', () => {
  const banido = /\bmarcas?\b/i;
  const infratores = ALVOS.filter((arquivo) => banido.test(readFileSync(join(process.cwd(), arquivo), 'utf8')));
  expect(infratores).toEqual([]);
});

it('nenhum arquivo da onda tem marcador de pendencia ou dado de demonstracao', () => {
  // TODO precisa ser case-sensitive: case-insensitive colidiria com a palavra
  // "Todo" do português (ex.: "Todo cliente tem..." — texto literal do protótipo).
  const proibidos = [/\bTODO\b/, /\b(TBD|FIXME|lorem ipsum)\b/i];
  const infratores = ALVOS.filter((arquivo) => {
    const conteudo = readFileSync(join(process.cwd(), arquivo), 'utf8');
    return proibidos.some((padrao) => padrao.test(conteudo));
  });
  expect(infratores).toEqual([]);
});

it('nenhuma tela da onda usa PlaceholderPage', () => {
  const infratores = ALVOS.filter((arquivo) => readFileSync(join(process.cwd(), arquivo), 'utf8').includes('PlaceholderPage'));
  expect(infratores).toEqual([]);
});
