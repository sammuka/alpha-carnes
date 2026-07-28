import { existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '../src/app/(admin)/comercial');

it('o cliente legado de pedido e a rota novo nao existem mais', () => {
  expect(existsSync(join(RAIZ, 'pedidos', `pedido-${'venda-client.tsx'}`))).toBe(false);
  expect(existsSync(join(RAIZ, 'pedidos', 'novo', 'page.tsx'))).toBe(false);
});
