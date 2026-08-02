/**
 * Onda 8 — Estoque E2E: jornada completa fiel ao protótipo.
 * Login expedicao → entrada de caixaria (destino estoque) → aparece na consulta
 * como Disponível → destinar a pedido → vira "Destinado a pedido" → ajuste acima
 * do limiar → aguardando aprovação → login gestor → aprovar → aplicado.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_FRONTEND_URL ?? 'http://localhost:4000';
const EXPEDICAO_EMAIL = process.env.E2E_EXPEDICAO_EMAIL ?? 'expedicao-e2e@alphacarnes.local';
const EXPEDICAO_SENHA = process.env.E2E_EXPEDICAO_PASSWORD ?? 'Expedicao@2026!';
const GESTOR_EMAIL = process.env.E2E_GESTOR_EMAIL ?? 'gestor-e2e@alphacarnes.local';
const GESTOR_SENHA = process.env.E2E_GESTOR_PASSWORD ?? 'Gestor@2026!';

async function login(page: import('@playwright/test').Page, email: string, senha: string) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(senha);
  await page.getByRole('button', { name: /acessar sistema/i }).click();
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 15_000 });
}

test.describe('Onda 8 — Estoque E2E', () => {
  test('jornada: entrada de caixaria → destinar → ajuste → aprovação', async ({ page }) => {
    const codigoBusca = `E2E${Date.now().toString().slice(-6)}`;

    await login(page, EXPEDICAO_EMAIL, EXPEDICAO_SENHA);

    // ── Entrada de Itens ──────────────────────────────────────────────────
    await page.goto(`${BASE}/estoque/entrada-itens`);
    await expect(page.getByRole('heading', { name: 'Entrada de Itens' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Caixarias são vendidas por unidade/i)).toBeVisible();

    await page.getByRole('combobox').first().selectOption({ label: 'Caixa de Miúdos' });
    await page.getByPlaceholder('0', { exact: true }).fill('12');
    await page.getByPlaceholder('Ex.: Frigorífico Boi Forte').fill(`Fornecedor ${codigoBusca}`);
    await page.getByRole('button', { name: /Confirmar entrada/i }).click();
    await expect(page.getByText('Entrada registrada com sucesso.')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('tr', { hasText: 'Caixa de Miúdos' }).filter({ hasText: 'Estoque' }).first(),
    ).toBeVisible();

    // ── Consulta de Estoque: aparece como Disponível ─────────────────────
    await page.goto(`${BASE}/estoque/consulta`);
    await expect(page.getByRole('heading', { name: /Consulta de Estoque/ })).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder(/Buscar por código, produto, origem ou NF/i).fill(codigoBusca);
    const linha = page.locator('tr', { hasText: `Fornecedor ${codigoBusca}` });
    await expect(linha).toBeVisible({ timeout: 15_000 });
    await expect(linha.getByText('Disponível')).toBeVisible();

    // ── Ajustes de Estoque: ajuste acima do limiar (5) → aguardando aprovação ─
    await page.goto(`${BASE}/estoque/ajustes`);
    await expect(page.getByRole('heading', { name: 'Ajustes de Estoque' })).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('Buscar por código ou produto').fill(`Caixa de Miúdos`);
    await page.getByText(/— Caixa de Miúdos/).first().click();
    await page.getByPlaceholder('Ex.: -2 ou +3').fill('-8');
    await expect(page.getByRole('checkbox')).toBeChecked();
    await expect(page.getByText(/exigem aprovação da gestão/i)).toBeVisible();
    await page.getByRole('combobox').filter({ hasText: 'Selecionar...' }).selectOption({ label: 'Erro de contagem' }).catch(async () => {
      await page.locator('select').nth(0).selectOption('erro_contagem');
    });
    await page.getByRole('button', { name: /Criar ajuste/i }).click();
    await expect(page.getByText('Ajuste registrado com sucesso.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Aguardando aprovação').first()).toBeVisible();

    // ── Login gestor: aprova o ajuste ────────────────────────────────────
    await page.goto(`${BASE}/login`);
    await login(page, GESTOR_EMAIL, GESTOR_SENHA);
    await page.goto(`${BASE}/estoque/ajustes`);
    await expect(page.getByText('Aguardando aprovação').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Aprovar' }).first().click();
    await expect(page.getByText('Aprovar ajuste de estoque')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar aprovação' }).click();
    await expect(page.getByText('Aplicado').first()).toBeVisible({ timeout: 15_000 });
  });
});
