/**
 * Evidência do shell da Onda 2: asserções estruturais + screenshots comparáveis
 * ao protótipo (docs/evidencias/onda2-shell/referencia-prototipo/).
 */

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

const ROOT_ENV = readEnvFile(path.join(__dirname, '..', '..', '..', '.env'));
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? ROOT_ENV.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ?? ROOT_ENV.SEED_ADMIN_PASSWORD ?? 'change-me-admin-password';
const EVIDENCIAS = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'onda2-shell');

const GRUPOS = [
  'COMERCIAL',
  'GESTÃO',
  'RECEBIMENTO & BALANÇA',
  'DESOSSA',
  'ESTOQUE',
  'CARGA',
  'FATURAMENTO',
  'CADASTROS & REGRAS',
  'ADMINISTRAÇÃO',
];

async function loginAdmin(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  baseURL: string,
) {
  const res = await request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok(), `login falhou: ${res.status()} ${await res.text()}`).toBeTruthy();
  const cookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => {
      const [nameValue] = h.value.split(';');
      const eq = nameValue.indexOf('=');
      return { name: nameValue.slice(0, eq), value: nameValue.slice(eq + 1), url: baseURL };
    });
  await page.context().addCookies(cookies);
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCIAS, { recursive: true });
});

test.describe('Shell + DS da Onda 2', () => {
  test('login exibe painel institucional e formulario fieis', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Distribuição inteligente ponta a ponta.' })).toBeVisible();
    await expect(page.getByText('Sistema Integrado')).toBeVisible();
    await expect(page.getByText('Bem-vindo de volta')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acessar Sistema' })).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCIAS, '01-login.png'), fullPage: true });
  });

  test('sidebar resolve o gradiente 1E3A5F→1B4E9B', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    const aside = page.getByRole('complementary', { name: 'Navegação principal' });
    await expect(aside).toBeVisible();
    const gradiente = await aside.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(gradiente).toContain('rgb(30, 58, 95)');
    expect(gradiente).toContain('rgb(27, 78, 155)');
  });

  test('menu do administrador tem os 9 grupos na ordem do prototipo', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    const aside = page.getByRole('complementary', { name: 'Navegação principal' });
    const titulos = await aside.locator('button[aria-expanded]').allInnerTexts();
    expect(titulos.map((t) => t.trim())).toEqual(GRUPOS);
  });

  test('pos-login o administrador entra por /gestao/dashboard', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/');
    await expect(page).toHaveURL(/\/gestao\/dashboard$/);
  });

  test('breadcrumb do dashboard e Gestão / Painel Geral da Operação', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    const breadcrumb = page.getByLabel('Breadcrumb');
    await expect(breadcrumb).toContainText('Gestão');
    await expect(breadcrumb).toContainText('Painel Geral da Operação');
  });

  // O colapso é max-height + overflow-hidden com os itens montados: um link clipado ainda tem
  // bounding box e continuaria "visível" para o Playwright. A asserção é do mecanismo real.
  test('colapso por grupo funciona no shell renderizado', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    const cabecalho = page.getByRole('button', { name: /COMERCIAL/ });
    const idPainel = await cabecalho.getAttribute('aria-controls');
    expect(idPainel).toBeTruthy();
    const painel = page.locator(`[id="${idPainel}"]`);

    if ((await painel.getAttribute('data-state')) === 'fechado') await cabecalho.click();
    await expect(cabecalho).toHaveAttribute('aria-expanded', 'true');
    await expect(painel).toHaveAttribute('data-state', 'aberto');
    await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible();

    await cabecalho.click();
    await expect(cabecalho).toHaveAttribute('aria-expanded', 'false');
    await expect(painel).toHaveAttribute('data-state', 'fechado');
    await expect(painel).toHaveCSS('max-height', '0px');
  });

  test('captura evidencias do shell e do login', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);
    await page.goto('/gestao/dashboard');
    await expect(page.getByRole('heading', { name: /Painel Geral da Operação/i })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(EVIDENCIAS, '02-shell-dashboard.png'), fullPage: true });
    await page
      .getByRole('complementary', { name: 'Navegação principal' })
      .screenshot({ path: path.join(EVIDENCIAS, '03-shell-sidebar-9-grupos.png') });
  });
});
