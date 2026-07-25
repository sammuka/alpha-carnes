import { test, expect } from '@playwright/test';

const ROTAS: Array<[string, string]> = [
  ['/cadastros/representantes', 'Representantes'],
  ['/cadastros/produtos', 'Produtos'],
  ['/cadastros/fornecedores', 'Fornecedores / Frigoríficos'],
  ['/cadastros/caminhoes', 'Caminhões'],
  ['/cadastros/motoristas', 'Motoristas'],
  ['/cadastros/rotas', 'Rotas / Itinerários'],
  ['/cadastros/regras-transformacao', 'Regras de Transformação'],
  ['/cadastros/modelos-etiqueta', 'Modelos de Etiqueta'],
  ['/admin/usuarios', 'Usuários'],
  ['/admin/perfis', 'Perfis de Acesso'],
  ['/admin/parametros', 'Parâmetros do Sistema'],
  ['/admin/auditoria', 'Auditoria'],
];

for (const [rota, titulo] of ROTAS) {
  test(`rota ${rota} abre com titulo e sem placeholder`, async ({ page }) => {
    const erros: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') erros.push(msg.text());
    });

    await page.goto(rota);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(titulo);
    await expect(page.getByText('Em construção')).toHaveCount(0);
    expect(erros).toEqual([]);
  });
}

test('menu do administrador leva as 12 rotas da onda', async ({ page }) => {
  await page.goto('/');
  for (const [rota] of ROTAS) {
    await expect(page.locator(`a[href="${rota}"]`)).toBeVisible();
  }
});
