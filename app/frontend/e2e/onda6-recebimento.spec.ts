import { test, expect } from '@playwright/test';

/**
 * Onda 6 — jornada das 3 rotas de recebimento (DoD 6.23 / 6.31).
 * Depende de app + seed; em CI com HARDWARE_FAKE=1 / NFSE_FAKE=1.
 */
test.describe('Onda 6 — recebimento', () => {
  test('percorre as 3 rotas de recebimento pelo menu', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-mail|email/i).fill(process.env.E2E_USER_EMAIL ?? 'admin@alphacarnes.local');
    await page.getByLabel(/senha/i).fill(process.env.E2E_USER_PASSWORD ?? 'Admin@123');
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await page.waitForURL(/\/(dashboard|operacao|recebimento)/);

    await page.goto('/recebimento/recebimento-carga');
    await expect(page.getByRole('heading', { name: /Recebimento de carga/i })).toBeVisible();

    await page.goto('/recebimento/pesagem-destinacao');
    await expect(page.getByText(/Balança|Pesagem/i).first()).toBeVisible();

    await page.goto('/recebimento/etiquetas');
    await expect(page.getByRole('heading', { name: /Etiquetas/i })).toBeVisible();

    const erros: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') erros.push(msg.text());
    });
    await page.goto('/recebimento/recebimento-carga');
    await page.waitForTimeout(500);
    expect(erros.filter((e) => !/favicon|websocket/i.test(e))).toEqual([]);
  });

  test('captura itens da NF e conclui a conferência pela tela', async ({ page }) => {
    test.skip(!process.env.E2E_ONDA6_SEED, 'Requer seed E2E_ONDA6_SEED com lote em aguardando_conferencia_final');

    await page.goto('/login');
    await page.getByLabel(/e-mail|email/i).fill(process.env.E2E_USER_EMAIL ?? 'admin@alphacarnes.local');
    await page.getByLabel(/senha/i).fill(process.env.E2E_USER_PASSWORD ?? 'Admin@123');
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await page.waitForURL(/\/(dashboard|operacao|recebimento)/);

    await page.goto('/recebimento/recebimento-carga');
    await page.getByRole('button', { name: 'Abrir' }).first().click();
    await page.getByTestId('btn-capturar-itens-nf').click();
    await page.getByTestId('btn-concluir').click();
    await page.getByTestId('btn-confirmar-conferencia').click();
    await expect(page.getByText(/Conferido/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
