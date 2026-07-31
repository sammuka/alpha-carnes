import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.E2E_CORTE_EMAIL ?? 'corte@alphacarnes.local';
const SENHA = process.env.E2E_CORTE_PASSWORD ?? 'Corte@AlphaCarnes2026!';

async function loginCorte(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/e-?mail/i).fill(EMAIL);
  await page.getByLabel(/senha/i).fill(SENHA);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/\/(gestao|desossa|comercial|recebimento)/);
}

test.describe('Onda 7 — desossa E2E', () => {
  test('dashboard, Modo TV, pesagem e etiquetas sem placeholder', async ({ page }) => {
    await loginCorte(page);

    await page.goto(`${BASE}/desossa/dashboard`);
    await expect(page.getByText('TZs na desossa')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Não representa produção em/i)).toBeVisible();
    await expect(page.getByText('Rota / Carga')).toBeVisible();
    await expect(page.getByText('Representante')).toBeVisible();
    await expect(page.getByText('TZs disponíveis para desossa')).toBeVisible();

    await page.getByRole('button', { name: /Modo TV/i }).click();
    await expect(page.getByText('CARGA / HORÁRIO')).toBeVisible();
    await page.getByRole('button', { name: /Sair/i }).click();

    await page.goto(`${BASE}/desossa/pesagem-destinacao`);
    await expect(page.getByText('Pesagem e Destinação')).toBeVisible();
    await expect(page.getByText(/Provisório/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Selecionar TZ/i })).toBeVisible();

    await page.goto(`${BASE}/desossa/etiquetas`);
    await expect(page.getByText('Etiquetas — Desossa')).toBeVisible();
    await expect(page.getByText('Peça mãe (TZ)')).toBeVisible();
    await expect(page.getByText('Origem peso')).toBeVisible();
    await expect(page.getByText('Cliente / Pedido')).toBeVisible();
    await expect(page.getByText('Pendente de impressão')).toBeVisible();
    await expect(page.getByText('Bloqueada')).toBeVisible();
  });
});
