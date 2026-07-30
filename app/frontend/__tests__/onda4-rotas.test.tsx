import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '../src/app/(admin)/comercial');
const ROTAS_DA_ONDA = [
  'clientes', 'pedidos', 'tabela-precos', 'disponibilidade', 'espelho',
] as const;

const ARQUIVOS_DA_ONDA = [
  ...ROTAS_DA_ONDA.map((rota) => join(RAIZ, rota)),
  join(__dirname, '../src/lib/precos.ts'),
  join(__dirname, '../src/lib/espelho.ts'),
  join(__dirname, '../src/lib/mapa-disponibilidade.ts'),
  join(__dirname, '../src/lib/status-pedido.ts'),
];

const TERMO_BANIDO = /\b[Mm]arcas?\b/;

/** Expande a lista em caminhos de `.ts`/`.tsx`: diretório vira varredura recursiva, arquivo vai
 * como está. Entrada inexistente falha: um skip silencioso deixaria o teste verde sem varrer tudo. */
function arquivosDeCodigo(entradas: string[]): string[] {
  return entradas.flatMap((entrada) => {
    if (!existsSync(entrada)) {
      throw new Error(`Caminho da onda 4 não existe: ${entrada}`);
    }
    if (!statSync(entrada).isDirectory()) return [entrada];
    return readdirSync(entrada, { recursive: true, encoding: 'utf8' })
      .filter((relativo) => /\.tsx?$/.test(relativo))
      .map((relativo) => join(entrada, relativo));
  });
}

it('o cliente legado de pedido e a rota novo nao existem mais', () => {
  expect(existsSync(join(RAIZ, 'pedidos', `pedido-${'venda-client.tsx'}`))).toBe(false);
  expect(existsSync(join(RAIZ, 'pedidos', 'novo', 'page.tsx'))).toBe(false);
});

it('as cinco rotas comerciais nao renderizam PlaceholderPage', () => {
  for (const rota of ROTAS_DA_ONDA) {
    const caminho = join(RAIZ, rota, 'page.tsx');
    expect(existsSync(caminho)).toBe(true);
    const fonte = readFileSync(caminho, 'utf8');
    expect(fonte).not.toMatch(/PlaceholderPage/);
  }
});

it('nenhum arquivo da onda 4 usa o termo banido como rotulo', () => {
  const infratores = arquivosDeCodigo(ARQUIVOS_DA_ONDA)
    .filter((arquivo) => TERMO_BANIDO.test(readFileSync(arquivo, 'utf8')));
  expect(infratores).toEqual([]);
});
