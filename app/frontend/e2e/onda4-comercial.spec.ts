import { expect, test } from '@playwright/test';
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
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    values[key] = value;
  }
  return values;
}

const ROOT_ENV = readEnvFile(path.join(__dirname, '..', '..', '..', '.env'));
const ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL ??
  ROOT_ENV.SEED_ADMIN_EMAIL ??
  'admin@alphacarnes.local';
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ??
  ROOT_ENV.SEED_ADMIN_PASSWORD ??
  'change-me-admin-password';

function cookiesFromResponse(
  response: import('@playwright/test').APIResponse,
  baseURL: string,
) {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => {
      const [nameValue] = header.value.split(';');
      const separator = nameValue.indexOf('=');
      return {
        name: nameValue.slice(0, separator),
        value: nameValue.slice(separator + 1),
        url: baseURL,
      };
    });
}

const TELAS_COMERCIAIS = [
  { path: '/comercial/clientes', heading: 'Cadastro de Clientes' },
  { path: '/comercial/pedidos', heading: 'Pedidos de Venda' },
  { path: '/comercial/tabela-precos', heading: 'Tabela de Preços' },
  { path: '/comercial/disponibilidade', heading: 'Disponibilidade' },
  { path: '/comercial/espelho', heading: 'Espelho Comercial' },
] as const;

test.describe('Onda 4 — jornada visual do comercial', () => {
  test('atravessa as cinco telas reais com os adaptadores fake', async ({
    page,
    request,
    baseURL,
  }) => {
    expect(process.env.HARDWARE_FAKE ?? ROOT_ENV.HARDWARE_FAKE).toBe('true');
    expect(process.env.NFSE_FAKE ?? ROOT_ENV.NFSE_FAKE).toBe('true');

    const login = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(login.ok(), `login falhou: ${login.status()} ${await login.text()}`)
      .toBeTruthy();
    await page.context().addCookies(cookiesFromResponse(login, baseURL!));

    for (const tela of TELAS_COMERCIAIS) {
      const response = await page.goto(tela.path, {
        waitUntil: 'domcontentloaded',
      });
      expect(response?.status(), tela.path).toBeLessThan(400);
      await expect(
        page.getByRole('heading', { name: tela.heading, exact: true }),
      ).toBeVisible();
      await expect(page.locator('body')).not.toContainText(
        /próximas fases|em desenvolvimento/i,
      );
    }
  });
});
