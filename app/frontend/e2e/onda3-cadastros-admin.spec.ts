import { test, expect, type BrowserContext } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Sessão de administrador reutilizada (Task 26.1 — storageState / 1 login). */
function readEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    values[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return values;
}

const ROOT_ENV = readEnvFile(path.join(__dirname, '..', '..', '..', '.env'));
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? ROOT_ENV.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ?? ROOT_ENV.SEED_ADMIN_PASSWORD ?? 'change-me-admin-password';

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

test.describe('Onda 3 — Cadastros & Admin', () => {
  test.describe.configure({ mode: 'serial' });

  let adminContext: BrowserContext;

  test.beforeAll(async ({ browser, baseURL }) => {
    adminContext = await browser.newContext({ baseURL });
    const res = await adminContext.request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok(), `login falhou: ${res.status()} ${await res.text()}`).toBeTruthy();
    // Persiste cookies da API request no storage do contexto (padrão shell-ds / storageState).
    const cookies = res
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => {
        const [nameValue] = h.value.split(';');
        const eq = nameValue.indexOf('=');
        return {
          name: nameValue.slice(0, eq),
          value: nameValue.slice(eq + 1),
          url: baseURL!,
        };
      });
    await adminContext.addCookies(cookies);
  });

  test.afterAll(async () => {
    await adminContext?.close();
  });

  for (const [rota, titulo] of ROTAS) {
    test(`rota ${rota} abre com titulo e sem placeholder`, async () => {
      const page = await adminContext.newPage();
      const erros: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') erros.push(msg.text());
      });

      try {
        await page.goto(rota);
        await expect(page.getByRole('heading', { level: 1 })).toContainText(titulo);
        await expect(page.getByText('Em construção')).toHaveCount(0);
        expect(erros).toEqual([]);
      } finally {
        await page.close();
      }
    });
  }

  test('menu do administrador leva as 12 rotas da onda', async () => {
    const page = await adminContext.newPage();
    try {
      await page.goto('/');
      for (const [rota] of ROTAS) {
        await expect(page.locator(`a[href="${rota}"]`)).toBeVisible();
      }
    } finally {
      await page.close();
    }
  });
});
