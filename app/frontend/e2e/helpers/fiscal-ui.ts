import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Passos de interface comuns às jornadas das telas fiscais T03, T04 e T05:
 * combos com busca no servidor, valor de campo da ficha e diálogos de decisão.
 */

/** Abre o combo pelo id do botão, digita a busca (debounce no servidor) e escolhe a opção. */
export async function escolherCombo(
  page: Page,
  escopo: Locator | Page,
  id: string,
  placeholder: string,
  termo: string,
  opcao: RegExp,
): Promise<void> {
  const gatilho = escopo.locator(`#${id}`);
  await expect(async () => {
    if ((await gatilho.getAttribute('aria-expanded')) !== 'true') await gatilho.click();
    await page.getByPlaceholder(placeholder).fill(termo);
    await expect(page.getByRole('option', { name: opcao })).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('option', { name: opcao }).click();
}

/** Valor em leitura de um campo da ficha: o bloco logo abaixo do rótulo. */
export function valorCampo(escopo: Locator | Page, rotulo: string): Locator {
  return escopo.getByText(rotulo, { exact: true }).locator('xpath=self::p/following-sibling::div[1]').first();
}

/** Abre o menu "Ações do processo" do cabeçalho e escolhe o item. */
export async function acaoDoProcesso(page: Page, item: string): Promise<void> {
  await page.getByRole('button', { name: /Ações do processo/ }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

/** Linha de rodapé "Exibindo N de M registros ... Página X de Y" da grade. */
export function paginacao(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Paginação' });
}
