/**
 * Onda 8 — captura de evidências fail-hard (Task 11 Step 2). Não é teste de
 * regressão contínua: gera screenshots reais das 3 rotas + aba Sobras para
 * docs/evidencias/onda8-estoque/, com asserts que falham se um elemento-chave
 * não estiver visível (sem screenshot "cego").
 */
import { test, expect } from '@playwright/test';
import * as path from 'node:path';

const BASE = process.env.E2E_FRONTEND_URL ?? 'http://localhost:4000';
const EXPEDICAO_EMAIL = process.env.E2E_EXPEDICAO_EMAIL ?? 'expedicao-e2e@alphacarnes.local';
const EXPEDICAO_SENHA = process.env.E2E_EXPEDICAO_PASSWORD ?? 'Expedicao@2026!';
const OUT_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'onda8-estoque');

test.describe('Onda 8 — evidências', () => {
  test('screenshots das 3 rotas + aba Sobras', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/e-?mail/i).fill(EXPEDICAO_EMAIL);
    await page.getByLabel(/senha/i).fill(EXPEDICAO_SENHA);
    await page.getByRole('button', { name: /acessar sistema/i }).click();
    await page.waitForURL((url) => url.pathname !== '/login', { timeout: 15_000 });

    // 1) Consulta de Estoque — aba Consulta
    await page.goto(`${BASE}/estoque/consulta`);
    await expect(page.getByRole('heading', { name: /Consulta de Estoque/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Consulta de Estoque', { exact: false }).first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT_DIR, 'app-consulta-estoque.png'), fullPage: true });

    // 2) Consulta de Estoque — aba Sobras & Congelamento
    await page.getByRole('button', { name: /Sobras.*Congelamento/i }).click();
    await expect(page.getByText('Túnel de Congelamento')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Provisório').first()).toBeVisible();
    await page.screenshot({ path: path.join(OUT_DIR, 'app-consulta-sobras.png'), fullPage: true });

    // 3) Entrada de Itens
    await page.goto(`${BASE}/estoque/entrada-itens`);
    await expect(page.getByRole('heading', { name: 'Entrada de Itens' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Caixarias são vendidas por unidade/i)).toBeVisible();
    await page.screenshot({ path: path.join(OUT_DIR, 'app-entrada-itens.png'), fullPage: true });

    // 4) Ajustes de Estoque
    await page.goto(`${BASE}/estoque/ajustes`);
    await expect(page.getByRole('heading', { name: 'Ajustes de Estoque' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Requer aprovação da gestão')).toBeVisible();
    await page.screenshot({ path: path.join(OUT_DIR, 'app-ajustes-estoque.png'), fullPage: true });
  });
});
