/**
 * Onda 5 — Usuários & Representantes: jornada de vincular representantes permitidos.
 * Critério 6.26 do plano tático (Portão 2, veredito "ajustar" de e2f6ca8).
 *
 * Fluxo: login admin → /admin/usuarios → abrir drawer de novo usuário → buscar e
 * selecionar um representante permitido → salvar → reabrir o usuário e confirmar que
 * a seleção persistiu (via GET /api/admin/usuarios refletido no drawer de edição).
 */

import { test, expect, type APIRequestContext, type BrowserContext } from '@playwright/test';
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
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const ROOT_ENV = readEnvFile(path.join(__dirname, '..', '..', '..', '.env'));
const BACKEND_ENV = readEnvFile(path.join(__dirname, '..', '..', 'backend', '.env'));

for (const envValues of [ROOT_ENV, BACKEND_ENV]) {
  for (const [key, value] of Object.entries(envValues)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4001';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? ROOT_ENV.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const ADMIN_PASSWORDS = [
  process.env.SEED_ADMIN_PASSWORD,
  ROOT_ENV.SEED_ADMIN_PASSWORD,
  'change-me-admin-password',
  'Admin@AlphaCarnes2026!',
].filter(Boolean) as string[];

function cookieHeaderFromResponse(res: import('@playwright/test').APIResponse): string {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0])
    .join('; ');
}

function cookiesFromResponse(
  res: import('@playwright/test').APIResponse,
  baseURL: string,
): { name: string; value: string; url: string }[] {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => {
      const [nameValue] = h.value.split(';');
      const eq = nameValue.indexOf('=');
      return { name: nameValue.slice(0, eq), value: nameValue.slice(eq + 1), url: baseURL };
    });
}

async function loginBackend(
  api: APIRequestContext,
  email: string,
  passwords: string[],
): Promise<{ cookieHeader: string; password: string }> {
  const errors: string[] = [];
  for (const password of passwords) {
    const res = await api.post(`${BACKEND_URL}/auth/login`, {
      data: { email, password },
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok()) return { cookieHeader: cookieHeaderFromResponse(res), password };
    errors.push(`${res.status()} ${await res.text().catch(() => '')}`);
  }
  throw new Error(`Login ${email} falhou: ${errors.join(' | ')}`);
}

async function criarRepresentante(
  api: APIRequestContext,
  adminCookie: string,
  suffix: string,
): Promise<{ id: string; nome: string }> {
  const nome = `Representante E2E Onda5 ${suffix}`;
  const res = await api.post(`${BACKEND_URL}/representantes`, {
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    data: { codigo: `O5REP${suffix}`, nome, status: 'ativo' },
  });
  if (!res.ok()) {
    throw new Error(`POST /representantes → ${res.status()}: ${await res.text().catch(() => '')}`);
  }
  const body = (await res.json()) as { id: string };
  return { id: body.id, nome };
}

test.describe('Onda 5 — Usuários: vincular representantes permitidos (6.26)', () => {
  test.describe.configure({ mode: 'serial' });

  let adminContext: BrowserContext;
  let representante: { id: string; nome: string };
  let suffix: string;
  let emailNovoUsuario: string;
  let nomeNovoUsuario: string;

  test.beforeAll(async ({ browser, baseURL, request }) => {
    suffix = Date.now().toString().slice(-8);
    emailNovoUsuario = `usuario.e2e.${suffix}@alphacarnes.local`;
    nomeNovoUsuario = `Usuário E2E Onda5 ${suffix}`;

    const { cookieHeader: adminCookieBackend, password: adminPassword } = await loginBackend(
      request,
      ADMIN_EMAIL,
      ADMIN_PASSWORDS,
    );
    representante = await criarRepresentante(request, adminCookieBackend, suffix);

    adminContext = await browser.newContext({ baseURL });
    const loginRes = await adminContext.request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: adminPassword },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes.ok(), `login admin falhou: ${loginRes.status()} ${await loginRes.text()}`).toBeTruthy();
    await adminContext.addCookies(cookiesFromResponse(loginRes, baseURL!));
  });

  test.afterAll(async () => {
    await adminContext?.close();
  });

  test('vincula representante permitido a um novo usuário e mantém a seleção ao reabrir', async () => {
    const page = await adminContext.newPage();
    try {
      await page.goto('/admin/usuarios');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Gestão de Usuários');

      await page.getByRole('button', { name: 'Novo Usuário' }).click();
      const sheetNovo = page.getByRole('dialog', { name: 'Novo Usuário' });
      await expect(sheetNovo).toBeVisible();

      await sheetNovo.locator('#nome').fill(nomeNovoUsuario);
      await sheetNovo.locator('#email').fill(emailNovoUsuario);
      await sheetNovo.locator('#senha').fill('SenhaForte@2026');

      await sheetNovo.getByPlaceholder('Buscar por nome').fill(representante.nome);
      const checkboxRepresentante = sheetNovo.getByRole('checkbox', { name: new RegExp(representante.nome) });
      await expect(checkboxRepresentante).toBeVisible({ timeout: 15_000 });
      await checkboxRepresentante.click();
      await expect(sheetNovo.getByText('1 selecionado(s)')).toBeVisible();

      const criacao = page.waitForResponse(
        (r) => r.url().includes('/api/admin/usuarios') && r.request().method() === 'POST',
      );
      await sheetNovo.getByRole('button', { name: 'Salvar' }).click();
      const criacaoRes = await criacao;
      expect(criacaoRes.ok(), `POST /api/admin/usuarios → ${criacaoRes.status()}`).toBeTruthy();
      await expect(sheetNovo).toBeHidden();

      const linha = page.locator('tr', { hasText: emailNovoUsuario });
      await expect(linha).toBeVisible({ timeout: 15_000 });

      await linha.getByRole('button').first().click();
      const sheetEditar = page.getByRole('dialog', { name: 'Editar Usuário' });
      await expect(sheetEditar).toBeVisible();
      await expect(sheetEditar.locator('#nome')).toHaveValue(nomeNovoUsuario);
      await expect(sheetEditar.getByText('1 selecionado(s)')).toBeVisible();
      await expect(
        sheetEditar.getByRole('checkbox', { name: new RegExp(representante.nome) }),
      ).toBeChecked();
    } finally {
      await page.close();
    }
  });
});
