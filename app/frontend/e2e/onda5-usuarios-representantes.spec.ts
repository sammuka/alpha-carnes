/**
 * Onda 5 — Usuários & Representantes: jornada de vincular representantes permitidos.
 * Critério 6.26 do plano tático (Portão 2, veredito "ajustar" de e2f6ca8).
 *
 * Fluxo: login admin → /admin/usuarios → abrir drawer de novo usuário → buscar e
 * selecionar um representante permitido → salvar → reabrir o usuário e confirmar que
 * a seleção persistiu (via GET /api/admin/usuarios refletido no drawer de edição).
 */

import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
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

// --- Jornada de autorização ponta a ponta (6.26, ajuste do veredito 2026-07-31) -----------------
//
// O teste "vincula representante..." acima só prova persistência da seleção no drawer.
// Esta segunda jornada prova o efeito de autorização: dois usuários comerciais reais,
// cada um restrito a um representante, logam na UI e enxergam clientes/pedidos distintos
// nas telas reais (/comercial/clientes, /comercial/pedidos). Se o filtro de escopo for
// removido do BFF/backend (ex.: `escopoRepresentantes` virar um predicado sempre verdadeiro),
// os dois comerciais passam a ver o cliente/pedido um do outro e os totais empatam — as
// asserções `toHaveCount(0)` e `not.toBe` abaixo falham nesse cenário.

async function backendCall<T>(
  api: APIRequestContext,
  cookieHeader: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  route: string,
  body?: unknown,
): Promise<T> {
  const res = await api.fetch(`${BACKEND_URL}${route}`, {
    method,
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    data: body,
  });
  const data = (await res.json().catch(async () => ({ raw: await res.text() }))) as T;
  if (!res.ok()) {
    throw new Error(`${method} ${route} → ${res.status()}: ${JSON.stringify(data)}`);
  }
  return data;
}

function addDaysISO(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// CPF sintético com dígitos verificadores válidos (o Zod do backend valida o dígito).
function makeCpf(seed: number): string {
  const baseNumber = 100_000_000 + (Math.abs(seed) % 899_999_999);
  const digits = String(baseNumber).split('').map(Number);
  const digit = (count: number) => {
    let sum = 0;
    for (let i = 0; i < count; i += 1) sum += (digits[i] ?? 0) * (count + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  digits.push(digit(9));
  digits.push(digit(10));
  return digits.join('');
}

async function obterOuCriarOperacaoExtraordinaria(
  api: APIRequestContext,
  adminCookie: string,
  dataOperacao: string,
  rotulo: string,
): Promise<{ id: string }> {
  const res = await api.fetch(`${BACKEND_URL}/operacoes/extraordinaria`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    data: { data: dataOperacao, rotulo },
  });
  if (res.ok()) return (await res.json()) as { id: string };
  if (res.status() === 409) {
    const list = await backendCall<{ data: Array<{ id: string }> }>(
      api,
      adminCookie,
      'GET',
      `/operacoes?de=${dataOperacao}&ate=${dataOperacao}&limite=1`,
    );
    const op = list.data?.[0];
    if (!op) throw new Error(`Operação em ${dataOperacao} não encontrada após conflito 409`);
    return op;
  }
  const body = await res.text().catch(() => '');
  throw new Error(`POST /operacoes/extraordinaria → ${res.status()}: ${body}`);
}

async function obterCompraConfirmadaDoDia(
  api: APIRequestContext,
  adminCookie: string,
  dataOperacao: string,
): Promise<{ id: string } | null> {
  const list = await backendCall<{ data: Array<{ id: string; dataOperacao: string; status: string }> }>(
    api,
    adminCookie,
    'GET',
    '/comercial/compras-programadas?limite=100',
  );
  return list.data.find((c) => c.dataOperacao === dataOperacao && c.status === 'confirmada') ?? null;
}

/**
 * Prepara N compras confirmadas em dias distintos (livres de conflito com runs anteriores).
 *
 * Nunca reaproveita uma compra confirmada já existente na data candidata: como cada run cria seu
 * próprio fornecedor/item de compra, reaproveitar a compra de um run anterior geraria disponibilidade
 * para o item comercial ERRADO (0 disponível para o item deste run) — a data é apenas pulada.
 */
async function prepararComprasConfirmadas(
  api: APIRequestContext,
  adminCookie: string,
  fornecedorId: string,
  produtoId: string,
  quantidadeNecessaria: number,
  rotuloPrefixo: string,
  offsetInicial: number,
): Promise<Array<{ dataOperacao: string; compraId: string }>> {
  const resultados: Array<{ dataOperacao: string; compraId: string }> = [];
  for (let offset = offsetInicial; offset < offsetInicial + 2000 && resultados.length < quantidadeNecessaria; offset += 1) {
    const candidata = addDaysISO(offset);
    try {
      await obterOuCriarOperacaoExtraordinaria(api, adminCookie, candidata, `${rotuloPrefixo} ${candidata}`);
    } catch {
      continue;
    }
    const existente = await obterCompraConfirmadaDoDia(api, adminCookie, candidata);
    if (existente) continue;
    const criarRes = await api.fetch(`${BACKEND_URL}/comercial/compras-programadas`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      data: {
        dataOperacao: candidata,
        fornecedorId,
        itens: [{ produtoId, quantidadeComprada: 100 }],
      },
    });
    if (criarRes.status() === 409) continue;
    if (!criarRes.ok()) {
      const body = await criarRes.text().catch(() => '');
      throw new Error(`POST compras-programadas → ${criarRes.status()}: ${body}`);
    }
    const criar = (await criarRes.json()) as { id: string };
    await backendCall(api, adminCookie, 'POST', `/comercial/compras-programadas/${criar.id}/confirmar`);
    resultados.push({ dataOperacao: candidata, compraId: criar.id });
  }
  if (resultados.length < quantidadeNecessaria) {
    throw new Error(`Não foi possível preparar ${quantidadeNecessaria} compras confirmadas para o E2E de escopo`);
  }
  return resultados;
}

async function criarClienteComRepresentante(
  api: APIRequestContext,
  adminCookie: string,
  razaoSocial: string,
  documentoFiscal: string,
  representanteId: string,
): Promise<{ id: string; razaoSocial: string }> {
  const res = await api.post(`${BACKEND_URL}/clientes`, {
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    data: {
      codigo: `O5ESC${documentoFiscal.slice(-6)}`,
      razaoSocial,
      documentoFiscal,
      representanteId,
    },
  });
  if (!res.ok()) {
    throw new Error(`POST /clientes → ${res.status()}: ${await res.text().catch(() => '')}`);
  }
  const body = (await res.json()) as { id: string; razaoSocial: string };
  return { id: body.id, razaoSocial: body.razaoSocial };
}

async function criarUsuarioComercialComEscopo(
  api: APIRequestContext,
  adminCookie: string,
  nome: string,
  email: string,
  password: string,
  representanteId: string,
): Promise<{ id: string }> {
  const res = await api.post(`${BACKEND_URL}/usuarios`, {
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    data: { nome, email, password, perfis: ['comercial'], representantes: [representanteId] },
  });
  if (!res.ok()) {
    throw new Error(`POST /usuarios → ${res.status()}: ${await res.text().catch(() => '')}`);
  }
  return (await res.json()) as { id: string };
}

test.describe('Onda 5 — Escopo por representante: clientes e pedidos distintos entre comerciais (6.26)', () => {
  test('admin configura escopo e backend o aplica ponta a ponta', async ({ browser, baseURL, request }) => {
    test.setTimeout(180_000);

    const suffix = Date.now().toString().slice(-8);
    const { cookieHeader: adminCookie } = await loginBackend(request, ADMIN_EMAIL, ADMIN_PASSWORDS);

    // 1. Admin cria dois representantes e um cliente vinculado a cada um.
    const repA = await criarRepresentante(request, adminCookie, `ESC${suffix}A`);
    const repB = await criarRepresentante(request, adminCookie, `ESC${suffix}B`);

    const clienteA = await criarClienteComRepresentante(
      request,
      adminCookie,
      `Cliente Escopo A ${suffix}`,
      makeCpf(Number(suffix) + 1),
      repA.id,
    );
    const clienteB = await criarClienteComRepresentante(
      request,
      adminCookie,
      `Cliente Escopo B ${suffix}`,
      makeCpf(Number(suffix) + 2),
      repB.id,
    );

    // 2. Catálogo mínimo para gerar disponibilidade e permitir reservar pedidos reais.
    const fornecedor = await backendCall<{ id: string }>(request, adminCookie, 'POST', '/fornecedores', {
      codigo: `O5ESCF${suffix}`,
      razaoSocial: `Fornecedor Escopo ${suffix}`,
      documentoFiscal: makeCpf(Number(suffix) + 3),
    });
    const itemCompra = await backendCall<{ id: string }>(request, adminCookie, 'POST', '/produtos', {
      codigo: `O5ESCIC${suffix}`,
      nome: 'Boi Escopo E2E',
      unidadePedido: 'unidade',
    });
    const itemComercial = await backendCall<{ id: string }>(request, adminCookie, 'POST', '/produtos', {
      codigo: `O5ESCTZ${suffix}`,
      nome: 'Traseiro Escopo E2E',
      unidadePedido: 'kg',
    });
    await backendCall(request, adminCookie, 'POST', '/regras-desdobramento', {
      produtoOrigemId: itemCompra.id,
    produtoDestinoId: itemComercial.id,
      fatorQuantidade: 2,
      status: 'ativo',
      vigenciaInicio: addDaysISO(-1),
    });

    // 3. Três compras confirmadas em dias distintos: duas alimentam os pedidos do cliente A,
    // uma alimenta o pedido do cliente B — totais de pedidos ficam propositalmente distintos (2 x 1).
    // Ponto de partida da busca por dias livres varia por run (baseado no timestamp) para não
    // colidir com compras confirmadas por execuções anteriores desta mesma suíte.
    const offsetInicial = 100 + (Number(suffix) % 5000);
    const [compra1, compra2, compra3] = await prepararComprasConfirmadas(
      request,
      adminCookie,
      fornecedor.id,
      itemCompra.id,
      3,
      `Onda5Escopo${suffix}`,
      offsetInicial,
    );

    // 4. Admin define o escopo: dois usuários comerciais reais, cada um restrito a um representante
    // (mesmo contrato que o drawer de "Representantes permitidos" usa — POST /usuarios com
    // `representantes: [id]`). Não reaproveita o usuário do seed como prova de autorização.
    const emailA = `comercial.escopo.a.${suffix}@alphacarnes.local`;
    const emailB = `comercial.escopo.b.${suffix}@alphacarnes.local`;
    const senha = 'SenhaForte@2026';
    await criarUsuarioComercialComEscopo(
      request,
      adminCookie,
      `Comercial Escopo A ${suffix}`,
      emailA,
      senha,
      repA.id,
    );
    await criarUsuarioComercialComEscopo(
      request,
      adminCookie,
      `Comercial Escopo B ${suffix}`,
      emailB,
      senha,
      repB.id,
    );

    // 5. Cada comercial registra os próprios pedidos (via API pública, com a própria sessão —
    // não é o admin criando por eles), exatamente como fariam a partir do editor de pedidos na UI.
    const { cookieHeader: comercialACookie } = await loginBackend(request, emailA, [senha]);
    const { cookieHeader: comercialBCookie } = await loginBackend(request, emailB, [senha]);

    await backendCall(request, comercialACookie, 'POST', '/comercial/pedidos', {
      compraProgramadaId: compra1.compraId,
      clienteId: clienteA.id,
      dataOperacao: compra1.dataOperacao,
      itens: [{ produtoId: itemComercial.id, quantidadePedida: 2 }],
    });
    await backendCall(request, comercialACookie, 'POST', '/comercial/pedidos', {
      compraProgramadaId: compra2.compraId,
      clienteId: clienteA.id,
      dataOperacao: compra2.dataOperacao,
      itens: [{ produtoId: itemComercial.id, quantidadePedida: 1 }],
    });
    await backendCall(request, comercialBCookie, 'POST', '/comercial/pedidos', {
      compraProgramadaId: compra3.compraId,
      clienteId: clienteB.id,
      dataOperacao: compra3.dataOperacao,
      itens: [{ produtoId: itemComercial.id, quantidadePedida: 3 }],
    });

    // 6. Login real na UI (cookies de sessão via /api/auth/login do próprio Next), um contexto de
    // navegador isolado por usuário — nada de reaproveitar sessão do admin ou do seed.
    async function loginUi(email: string): Promise<BrowserContext> {
      const context = await browser.newContext({ baseURL });
      const loginRes = await context.request.post('/api/auth/login', {
        data: { email, password: senha },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(loginRes.ok(), `login ${email} falhou: ${loginRes.status()} ${await loginRes.text()}`).toBeTruthy();
      await context.addCookies(cookiesFromResponse(loginRes, baseURL!));
      return context;
    }

    const contextA = await loginUi(emailA);
    const contextB = await loginUi(emailB);

    try {
      // 7. Tela real de clientes (/comercial/clientes): cada comercial só enxerga o cliente
      // do próprio representante. Se o escopo caísse, ambos veriam os dois clientes.
      async function abrirClientes(context: BrowserContext): Promise<Page> {
        const page = await context.newPage();
        await page.goto('/comercial/clientes');
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Cadastro de Clientes');
        return page;
      }

      const pageClientesA = await abrirClientes(contextA);
      const asideA = pageClientesA.locator('aside');
      await expect(asideA.getByText(clienteA.razaoSocial, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(asideA.getByText(clienteB.razaoSocial, { exact: true })).toHaveCount(0);

      const pageClientesB = await abrirClientes(contextB);
      const asideB = pageClientesB.locator('aside');
      await expect(asideB.getByText(clienteB.razaoSocial, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(asideB.getByText(clienteA.razaoSocial, { exact: true })).toHaveCount(0);

      // 8. Tela real de pedidos (/comercial/pedidos): linhas e KPI "Total de pedidos" distintos
      // entre os dois comerciais (2 x 1). Se o escopo caísse, os dois veriam os 3 pedidos e o
      // KPI empataria em 3 — as asserções abaixo (toHaveCount(0) e not.toBe) quebrariam.
      async function abrirPedidosComTotal(context: BrowserContext): Promise<{ page: Page; total: string }> {
        const page = await context.newPage();
        const respostaLista = page.waitForResponse(
          (r) => r.url().includes('/api/comercial/pedidos') && r.request().method() === 'GET' && r.ok(),
        );
        await page.goto('/comercial/pedidos');
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Pedidos de Venda');
        await respostaLista;
        const kpiTotal = page.locator('div.rounded-xl', { hasText: 'Total de pedidos' }).first();
        const total = await kpiTotal.locator('p').nth(1).innerText();
        return { page, total };
      }

      const { page: pagePedidosA, total: totalA } = await abrirPedidosComTotal(contextA);
      const { page: pagePedidosB, total: totalB } = await abrirPedidosComTotal(contextB);

      expect(totalA).toBe('2');
      expect(totalB).toBe('1');
      expect(totalA).not.toBe(totalB);

      const listaA = pagePedidosA.locator('div.divide-y');
      await expect(listaA.getByText(clienteA.razaoSocial, { exact: true })).toHaveCount(2);
      await expect(listaA.getByText(clienteB.razaoSocial, { exact: true })).toHaveCount(0);

      const listaB = pagePedidosB.locator('div.divide-y');
      await expect(listaB.getByText(clienteB.razaoSocial, { exact: true })).toHaveCount(1);
      await expect(listaB.getByText(clienteA.razaoSocial, { exact: true })).toHaveCount(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
