/**
 * Smoke test — rotas v2 do menu canônico após absorção do protótipo.
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
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? ROOT_ENV.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ?? ROOT_ENV.SEED_ADMIN_PASSWORD ?? 'change-me-admin-password';

type TelaSpec = {
  path: string;
  tituloEsperado?: RegExp;
  placeholder?: boolean;
};

const ROTAS_V2: TelaSpec[] = [
  { path: '/comercial/clientes', tituloEsperado: /clientes/i },
  { path: '/comercial/pedidos', tituloEsperado: /pedidos/i },
  { path: '/comercial/tabela-precos', placeholder: true, tituloEsperado: /tabela de preços/i },
  { path: '/comercial/disponibilidade', tituloEsperado: /disponibilidade/i },
  { path: '/comercial/espelho', placeholder: true, tituloEsperado: /espelho/i },
  { path: '/gestao/dashboard', tituloEsperado: /dashboard operacional/i },
  { path: '/gestao/compras', tituloEsperado: /compras/i },
  { path: '/gestao/aprovacoes', placeholder: true, tituloEsperado: /aprovações/i },
  { path: '/gestao/relatorios', placeholder: true, tituloEsperado: /relatórios/i },
  { path: '/recebimento/recebimento-carga', tituloEsperado: /recebimento/i },
  { path: '/recebimento/pesagem-destinacao', tituloEsperado: /pesagem/i },
  { path: '/recebimento/etiquetas', tituloEsperado: /etiqueta/i },
  { path: '/desossa/dashboard', tituloEsperado: /desossa/i },
  { path: '/desossa/pesagem-destinacao', placeholder: true, tituloEsperado: /pesagem e destinação/i },
  { path: '/desossa/etiquetas', placeholder: true, tituloEsperado: /etiquetas/i },
  { path: '/estoque/consulta', tituloEsperado: /estoque/i },
  { path: '/estoque/entrada-itens', placeholder: true, tituloEsperado: /entrada de itens/i },
  { path: '/estoque/ajustes', placeholder: true, tituloEsperado: /ajustes/i },
  { path: '/carga/planejamento', tituloEsperado: /planejamento|expedi/i },
  { path: '/carga/conferencia', tituloEsperado: /confer/i },
  { path: '/carga/enviar-faturamento', placeholder: true, tituloEsperado: /enviar para faturamento/i },
  { path: '/faturamento/pre-faturamento', tituloEsperado: /faturamento|pré/i },
  { path: '/faturamento/notas-xml', placeholder: true, tituloEsperado: /notas/i },
  { path: '/faturamento/seguro-manual', placeholder: true, tituloEsperado: /seguro/i },
  { path: '/faturamento/liberacao', tituloEsperado: /libera/i },
  { path: '/cadastros/representantes', placeholder: true, tituloEsperado: /representantes/i },
  { path: '/cadastros/produtos', tituloEsperado: /produtos/i },
  { path: '/cadastros/fornecedores', tituloEsperado: /fornecedor/i },
  { path: '/cadastros/caminhoes', placeholder: true, tituloEsperado: /caminhões/i },
  { path: '/cadastros/motoristas', placeholder: true, tituloEsperado: /motoristas/i },
  { path: '/cadastros/rotas', tituloEsperado: /rotas/i },
  { path: '/cadastros/regras-transformacao', tituloEsperado: /regras de transformação/i },
  { path: '/cadastros/modelos-etiqueta', placeholder: true, tituloEsperado: /modelos de etiqueta/i },
  { path: '/admin/usuarios', tituloEsperado: /usuários|usuarios/i },
  { path: '/admin/perfis', placeholder: true, tituloEsperado: /perfis/i },
  { path: '/admin/parametros', placeholder: true, tituloEsperado: /parâmetros/i },
  { path: '/admin/auditoria', tituloEsperado: /auditoria/i },
  { path: '/operacao/recebimento' },
  { path: '/operacao/pesagem' },
  { path: '/operacao/corte' },
  { path: '/operacao/expedicao' },
  { path: '/operacao/faturamento' },
];

function cookiesFromResponse(
  res: import('@playwright/test').APIResponse,
  baseURL: string,
): { name: string; value: string; url: string; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict' | 'None' }[] {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => {
      const parts = h.value.split(';').map((p) => p.trim());
      const [nameValue, ...attrs] = parts;
      const eq = nameValue.indexOf('=');
      const name = nameValue.slice(0, eq);
      const value = nameValue.slice(eq + 1);
      const cookie: {
        name: string;
        value: string;
        url: string;
        httpOnly?: boolean;
        sameSite?: 'Lax' | 'Strict' | 'None';
      } = { name, value, url: baseURL };
      for (const attr of attrs) {
        const lower = attr.toLowerCase();
        if (lower === 'httponly') cookie.httpOnly = true;
        if (lower.startsWith('samesite=')) {
          const ss = attr.split('=')[1];
          if (ss === 'Lax' || ss === 'Strict' || ss === 'None') cookie.sameSite = ss;
        }
      }
      return cookie;
    });
}

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
  await page.context().addCookies(cookiesFromResponse(res, baseURL));
  await page.goto('/gestao/dashboard');
  await expect(page.getByRole('heading', { name: /Dashboard Operacional/i })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('Telas migradas v2', () => {
  test('todas as rotas do menu carregam após login', async ({ page, request, baseURL }) => {
    await loginAdmin(page, request, baseURL!);

    const falhas: string[] = [];

    for (const tela of ROTAS_V2) {
      const response = await page.goto(tela.path, { waitUntil: 'domcontentloaded' });
      const status = response?.status() ?? 0;

      if (status >= 400) {
        falhas.push(`${tela.path}: HTTP ${status}`);
        continue;
      }

      if (page.url().includes('/login')) {
        falhas.push(`${tela.path}: redirecionou para login`);
        continue;
      }

      const bodyText = await page.locator('body').innerText();
      if (/Application error|Internal Server Error|Build Error|Hydration failed/i.test(bodyText)) {
        falhas.push(`${tela.path}: erro na página`);
        continue;
      }

      if (tela.tituloEsperado && !tela.tituloEsperado.test(bodyText)) {
        falhas.push(`${tela.path}: título esperado não encontrado (${tela.tituloEsperado})`);
      }

      if (tela.placeholder && !/próximas fases|em desenvolvimento/i.test(bodyText)) {
        falhas.push(`${tela.path}: deveria exibir placeholder`);
      }
    }

    expect(falhas, falhas.join('\n')).toEqual([]);
  });
});
