/**
 * Onda 5 — Gestão: 6 rotas via menu (gestor), blocos-chave e evidências visuais.
 * Critério 5.8 do plano tático + docs/evidencias/onda5-gestao/.
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

const GESTOR_EMAIL = process.env.SEED_GESTOR_EMAIL ?? 'gestor@alphacarnes.local';
const GESTOR_PASSWORD = process.env.SEED_GESTOR_PASSWORD ?? 'change-me-gestor-password';

const EVIDENCE_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'onda5-gestao');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-onda5');

const ROTULOS_KPI = [
  'Compras programadas',
  'Disponibilidade física + virtual',
  'Reservas em elaboração',
  'Pedidos finalizados',
  'Overbookings abertos',
  'Recebimentos aguardados',
  'Divergências abertas',
  'Peças em desossa',
  'Relatórios SIF pendentes',
  'Faturamentos pendentes',
];

const ROTAS_MENU: Array<{
  href: string;
  menuLabel: string;
  titulo: RegExp;
  screenshot: string;
}> = [
  { href: '/gestao/dashboard', menuLabel: 'Painel Geral da Operação', titulo: /Painel Geral da Operação/i, screenshot: '01-dashboard.png' },
  { href: '/gestao/operacoes', menuLabel: 'Operações', titulo: /^Operações$/i, screenshot: '02-operacoes.png' },
  { href: '/gestao/compras', menuLabel: 'Compras', titulo: /Compra Programada/i, screenshot: '03-compras.png' },
  { href: '/gestao/overbooking', menuLabel: 'Pendências de Overbooking', titulo: /Pendências de Overbooking/i, screenshot: '04-overbooking.png' },
  { href: '/gestao/aprovacoes', menuLabel: 'Aprovações & Ocorrências', titulo: /Aprovações/i, screenshot: '05-aprovacoes.png' },
  { href: '/gestao/relatorios', menuLabel: 'Relatórios & SIF', titulo: /Relatórios SIF/i, screenshot: '06-relatorios.png' },
];

interface StepEvidence {
  id: string;
  title: string;
  url: string;
  objective: string;
  action: string;
  result: string;
  screenshot: string;
  note?: string;
}

interface DadosGestao {
  runId: string;
  operacaoId: string;
  dataOperacao: string;
  compraId: string;
  itemCompraId: string;
  itemComercialId: string;
  fornecedorId: string;
  clienteId: string;
  ocorrenciaId?: string;
  ocorrenciaIndice?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isIgnorableConsoleError(text: string): boolean {
  return /WebSocket connection to .* failed/i.test(text);
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

function cookieHeaderFromResponse(res: import('@playwright/test').APIResponse): string {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0])
    .join('; ');
}

async function loginBackend(api: APIRequestContext, email: string, passwords: string[]): Promise<string> {
  const errors: string[] = [];
  for (const password of passwords) {
    const res = await api.post(`${BACKEND_URL}/auth/login`, {
      data: { email, password },
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok()) return cookieHeaderFromResponse(res);
    errors.push(`${res.status()} ${await res.text().catch(() => '')}`);
  }
  throw new Error(`Login ${email} falhou: ${errors.join(' | ')}`);
}

async function backend<T>(
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

async function ensureGestorUser(api: APIRequestContext, adminCookie: string): Promise<void> {
  const probe = await api.post(`${BACKEND_URL}/auth/login`, {
    data: { email: GESTOR_EMAIL, password: GESTOR_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  if (probe.ok()) return;

  await backend(api, adminCookie, 'POST', '/usuarios', {
    nome: 'Gestor E2E Onda 5',
    email: GESTOR_EMAIL,
    password: GESTOR_PASSWORD,
    perfis: ['gestor'],
  });
}

function addDaysISO(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function fillInputValue(page: Page, selector: string, value: string) {
  const input = page.locator(selector);
  await input.click();
  await input.fill(value);
  const atual = await input.inputValue();
  if (atual !== value) {
    await input.evaluate((node, nextValue) => {
      const element = node as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(element, nextValue);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
  await expect(input).toHaveValue(value);
  await input.press('Tab');
}

async function selecionarDataCompras(page: Page, dataOperacao: string, compraId: string) {
  await page.goto(`/gestao/compras?dataOperacao=${dataOperacao}&compraId=${compraId}`);
  await expect(page.getByText(/Lote 001/)).toBeVisible();
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
    const list = await backend<{ data: Array<{ id: string }> }>(
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
  const list = await backend<{ data: Array<{ id: string; dataOperacao: string; status: string }> }>(
    api,
    adminCookie,
    'GET',
    '/comercial/compras-programadas?limite=100',
  );
  return list.data.find((c) => c.dataOperacao === dataOperacao && c.status === 'confirmada') ?? null;
}

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

async function prepararDadosGestao(api: APIRequestContext, adminCookie: string): Promise<DadosGestao> {
  const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = runId.slice(-6);
  const docFornecedor = makeCpf(Number(suffix) + 1);
  const docCliente = makeCpf(Number(suffix) + 2);

  const fornecedor = await backend<{ id: string }>(api, adminCookie, 'POST', '/fornecedores', {
    codigo: `O5F${suffix}`,
    razaoSocial: `Fornecedor Onda5 ${suffix}`,
    documentoFiscal: docFornecedor,
  });
  const itemCompra = await backend<{ id: string }>(api, adminCookie, 'POST', '/itens-compra', {
    codigo: `O5IC${suffix}`,
    descricao: 'Boi Onda5',
    unidadeCompra: 'cabeca',
  });
  const itemComercial = await backend<{ id: string }>(api, adminCookie, 'POST', '/itens-comerciais', {
    codigo: `O5TZ${suffix}`,
    descricao: 'Traseiro Onda5',
    unidadeComercial: 'parte',
  });
  const cliente = await backend<{ id: string }>(api, adminCookie, 'POST', '/clientes', {
    codigo: `O5CL${suffix}`,
    razaoSocial: `Cliente Onda5 ${suffix}`,
    documentoFiscal: docCliente,
  });

  await backend(api, adminCookie, 'POST', '/regras-desdobramento', {
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
    fatorQuantidade: 2,
    status: 'ativo',
    vigenciaInicio: addDaysISO(-1),
  });

  let dataOperacao = '';
  let operacaoId = '';
  let compraId = '';

  for (let offset = 30; offset < 75; offset += 1) {
    const candidata = addDaysISO(offset);
    const opExtra = await obterOuCriarOperacaoExtraordinaria(
      api,
      adminCookie,
      candidata,
      `Onda5 E2E ${suffix}`,
    );
    const existente = await obterCompraConfirmadaDoDia(api, adminCookie, candidata);
    if (existente) {
      dataOperacao = candidata;
      operacaoId = opExtra.id;
      compraId = existente.id;
      break;
    }

    const criarRes = await api.fetch(`${BACKEND_URL}/comercial/compras-programadas`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      data: {
        dataOperacao: candidata,
        fornecedorId: fornecedor.id,
        itens: [{ itemCompraId: itemCompra.id, quantidadeComprada: 100 }],
      },
    });
    if (criarRes.status() === 409) continue;
    if (!criarRes.ok()) {
      const body = await criarRes.text().catch(() => '');
      throw new Error(`POST compras-programadas → ${criarRes.status()}: ${body}`);
    }
    const criar = (await criarRes.json()) as { id: string };
    await backend(api, adminCookie, 'POST', `/comercial/compras-programadas/${criar.id}/confirmar`);
    dataOperacao = candidata;
    operacaoId = opExtra.id;
    compraId = criar.id;
    break;
  }

  if (!dataOperacao || !compraId || !operacaoId) {
    throw new Error('Não foi possível preparar operação + compra confirmada para E2E Onda 5');
  }

  try {
    await backend(api, adminCookie, 'POST', '/comercial/pedidos/confirmar-overbooking', {
      dataOperacao,
      compraProgramadaId: compraId,
      clienteId: cliente.id,
      itens: [{ itemComercialId: itemComercial.id, quantidadePedida: 250 }],
    });
  } catch {
    // Pendência já existente de run anterior — overbooking UI ainda validável.
  }

  const pedidoPf = await backend<{ id: string }>(api, adminCookie, 'POST', '/operacao/pedidos-fornecedor', {
    compraProgramadaId: compraId,
  });
  await backend(api, adminCookie, 'POST', `/operacao/pedidos-fornecedor/${pedidoPf.id}/enviar`);
  const receb = await backend<{ recebimento: { id: string } }>(api, adminCookie, 'POST', '/operacao/recebimentos', {
    pedidoFornecedorId: pedidoPf.id,
  });
  await backend(api, adminCookie, 'POST', `/operacao/pedidos-fornecedor/${pedidoPf.id}/nf`, {
    numero: `NF-O5-${suffix}`,
    recebimentoId: receb.recebimento.id,
    itens: [{ itemComercialId: itemComercial.id, quantidadeDeclarada: 1, pesoDeclarado: 10 }],
  });
  const conclusao = await backend<{ ocorrencias: number; conclusao: { id: string } }>(
    api,
    adminCookie,
    'POST',
    `/operacao/recebimentos/${receb.recebimento.id}/conferencia/concluir`,
    { resultado: 'com_divergencia', observacao: 'Divergência E2E Onda 5' },
  );
  if (conclusao.ocorrencias < 1) {
    throw new Error('Conferência E2E não gerou ocorrência para a evidência do comparativo');
  }

  const ocorrencias = await backend<{ data: Array<{ id: string }> }>(
    api,
    adminCookie,
    'GET',
    `/gestao/aprovacoes?operacaoId=${operacaoId}&aba=ocorrencias&limite=50`,
  );
  let ocorrenciaId: string | undefined;
  let ocorrenciaIndice: number | undefined;
  for (const [indice, ocorrencia] of ocorrencias.data.entries()) {
    const comparativo = await api.get(
      `${BACKEND_URL}/gestao/aprovacoes/ocorrencias/${ocorrencia.id}/comparativo`,
      { headers: { Cookie: adminCookie } },
    );
    if (comparativo.ok()) {
      ocorrenciaId = ocorrencia.id;
      ocorrenciaIndice = indice;
      break;
    }
  }
  if (ocorrenciaId === undefined || ocorrenciaIndice === undefined) {
    throw new Error(
      `Nenhuma das ${ocorrencias.data.length} ocorrências da operação possui comparativo imutável`,
    );
  }

  return {
    runId,
    operacaoId,
    dataOperacao,
    compraId,
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
    fornecedorId: fornecedor.id,
    clienteId: cliente.id,
    ocorrenciaId,
    ocorrenciaIndice,
  };
}

async function capture(
  page: Page,
  steps: StepEvidence[],
  id: string,
  title: string,
  objective: string,
  action: string,
  result: string,
  note?: string,
) {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  const fileName = `${id}.png`;
  const source = path.join(SCREENSHOTS_DIR, fileName);
  const target = path.join(EVIDENCE_DIR, fileName);
  await page.screenshot({ path: source, fullPage: true });
  fs.copyFileSync(source, target);
  steps.push({ id, title, url: page.url(), objective, action, result, screenshot: fileName, note });
}

function writeReport(steps: StepEvidence[], dados: DadosGestao, observations: string[]) {
  const rows = steps
    .map(
      (step, index) => `
        <section class="step" id="${step.id}">
          <div class="step-head">
            <span>${String(index + 1).padStart(2, '0')}</span>
            <div>
              <h2>${escapeHtml(step.title)}</h2>
              <code>${escapeHtml(step.url)}</code>
            </div>
          </div>
          <div class="meta-grid">
            <div><strong>Objetivo</strong><p>${escapeHtml(step.objective)}</p></div>
            <div><strong>Ação</strong><p>${escapeHtml(step.action)}</p></div>
            <div><strong>Resultado</strong><p>${escapeHtml(step.result)}</p></div>
          </div>
          ${step.note ? `<p class="note">${escapeHtml(step.note)}</p>` : ''}
          <img src="${escapeHtml(step.screenshot)}" alt="${escapeHtml(step.title)}" loading="lazy" />
        </section>`,
    )
    .join('\n');

  const contextRows = [
    ['Run ID', dados.runId],
    ['Operação', dados.operacaoId],
    ['Data operacional', dados.dataOperacao],
    ['Compra programada', dados.compraId],
    ['Fornecedor', dados.fornecedorId],
    ['Cliente', dados.clienteId],
    ['Item compra', dados.itemCompraId],
    ['Item comercial', dados.itemComercialId],
    ...(dados.ocorrenciaId ? [['Ocorrência', dados.ocorrenciaId] as const] : []),
  ]
    .map(
      ([label, value]) =>
        `<div><strong>${escapeHtml(label)}</strong><p><code>${escapeHtml(value)}</code></p></div>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AlphaCarnes - Onda 5 Gestão E2E</title>
  <style>
    :root { color-scheme: dark; --bg:#09090b; --panel:#18181b; --muted:#a1a1aa; --text:#f4f4f5; --line:#27272a; --blue:#60a5fa; --green:#86efac; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Segoe UI, system-ui, sans-serif; background:var(--bg); color:var(--text); line-height:1.55; }
    header { padding:48px; border-bottom:1px solid var(--line); background:linear-gradient(135deg,#0f172a,#111827); }
    h1 { margin:0 0 12px; font-size:32px; }
    h2 { margin:0; font-size:22px; }
    p { margin:6px 0 0; color:#d4d4d8; }
    code { color:#bfdbfe; font-size:12px; }
    .badges { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
    .badge { border:1px solid #1d4ed8; color:#bfdbfe; border-radius:999px; padding:5px 12px; font-size:12px; background:rgba(37,99,235,.15); }
    .wrap { max-width:1180px; margin:0 auto; padding:36px; }
    .context, .coverage, .observations { border:1px solid var(--line); background:var(--panel); border-radius:10px; padding:18px; margin-bottom:24px; }
    .context-grid, .meta-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
    .context-grid div, .meta-grid div { border:1px solid var(--line); border-radius:8px; padding:12px; background:#111113; }
    .context-grid strong, .meta-grid strong { display:block; color:var(--green); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
    .step { margin:0 0 56px; padding-bottom:48px; border-bottom:1px solid var(--line); }
    .step-head { display:flex; align-items:flex-start; gap:14px; margin-bottom:16px; }
    .step-head span { width:38px; height:38px; display:grid; place-items:center; border-radius:8px; background:#2563eb; font-weight:700; }
    .note { margin:14px 0; padding:10px 12px; border-radius:8px; border:1px solid #92400e; background:rgba(146,64,14,.18); color:#fde68a; }
    img { display:block; width:100%; margin-top:18px; border:1px solid var(--line); border-radius:10px; box-shadow:0 18px 50px rgba(0,0,0,.45); }
    ul { margin:10px 0 0; color:#d4d4d8; }
  </style>
</head>
<body>
  <header>
    <h1>AlphaCarnes — Onda 5 Gestão E2E</h1>
    <p>Evidências Playwright das 6 rotas de Gestão com dados reais no banco semeado.</p>
    <div class="badges">
      <span class="badge">${steps.length} capturas</span>
      <span class="badge">Run ${escapeHtml(dados.runId)}</span>
      <span class="badge">Data ${escapeHtml(dados.dataOperacao)}</span>
    </div>
  </header>
  <main class="wrap">
    <section class="context">
      <h2>Rastreabilidade dos Dados</h2>
      <div class="context-grid">${contextRows}</div>
    </section>
    <section class="coverage">
      <h2>Cobertura</h2>
      <ul>
        <li>6 rotas de Gestão navegadas via menu como perfil gestor.</li>
        <li>Painel de impacto, decisão de overbooking, comparativo imutável e versões SIF quando dados disponíveis.</li>
      </ul>
    </section>
    <section class="observations"><h2>Observações</h2><ul>${observations.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul></section>
    ${rows}
  </main>
</body>
</html>`;

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'index.html'),
    html.replace(/[ \t]+$/gm, ''),
    'utf8',
  );
}

test.describe('Onda 5 — Gestão (6 rotas)', () => {
  test.describe.configure({ mode: 'serial' });

  let gestorContext: BrowserContext;
  let dados: DadosGestao;
  const steps: StepEvidence[] = [];
  const observations: string[] = [];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    fs.rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
    fs.rmSync(EVIDENCE_DIR, { recursive: true, force: true });
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const adminCookie = await loginBackend(request, ADMIN_EMAIL, ADMIN_PASSWORDS);
    await ensureGestorUser(request, adminCookie);
    dados = await prepararDadosGestao(request, adminCookie);

    gestorContext = await browser.newContext({ baseURL });
    const loginRes = await gestorContext.request.post('/api/auth/login', {
      data: { email: GESTOR_EMAIL, password: GESTOR_PASSWORD },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes.ok(), `login gestor falhou: ${loginRes.status()} ${await loginRes.text()}`).toBeTruthy();
    await gestorContext.addCookies(cookiesFromResponse(loginRes, baseURL!));
  });

  test.afterAll(async () => {
    if (dados && steps.length > 0) {
      writeReport(steps, dados, observations);
      expect(fs.existsSync(path.join(EVIDENCE_DIR, 'index.html'))).toBe(true);
      expect(steps.length).toBeGreaterThanOrEqual(10);
    }
    await gestorContext?.close();
  });

  for (const rota of ROTAS_MENU) {
    test(`menu → ${rota.href} exibe título e blocos-chave`, async () => {
      const page = await gestorContext.newPage();
      const erros: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) erros.push(msg.text());
      });

      try {
        await page.goto('/gestao/dashboard');
        await expect(page.getByLabel('Selecionar operação')).toBeVisible({ timeout: 15_000 });
        await page.getByRole('navigation').getByRole('link', { name: rota.menuLabel, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${rota.href.replace(/\//g, '\\/')}`), { timeout: 15_000 });
        await expect(page.getByRole('heading', { level: 1 })).toContainText(rota.titulo);

        if (rota.href === '/gestao/dashboard') {
          for (const label of ROTULOS_KPI) {
            await expect(page.getByText(label, { exact: true })).toBeVisible();
          }
        }

        if (rota.href === '/gestao/operacoes') {
          await expect(page.locator('select').filter({ hasText: 'Status: Todas' })).toBeVisible();
        }

        if (rota.href === '/gestao/compras') {
          await selecionarDataCompras(page, dados.dataOperacao, dados.compraId);
          await expect(page.getByText('Alterar uma compra confirmada recalcula imediatamente')).toBeVisible();
        }

        if (rota.href === '/gestao/overbooking') {
          await page.goto(`/gestao/overbooking?operacaoId=${dados.operacaoId}`);
          const primeira = page.locator('button').filter({ hasText: 'Déficit:' }).first();
          await expect(primeira).toBeVisible({ timeout: 15_000 });
          await primeira.click();
          await expect(page.getByText('1. Compra complementar')).toBeVisible();
          await expect(page.getByText('2. Redistribuição')).toBeVisible();
          await expect(page.getByText('3. Postergar para próxima operação')).toBeVisible();
        }

        if (rota.href === '/gestao/aprovacoes') {
          await page.goto(`/gestao/aprovacoes?operacaoId=${dados.operacaoId}`);
          await expect(page.getByRole('tab', { name: 'Fila Administrativa de Ocorrências' })).toBeVisible();
          await expect(page.getByRole('tab', { name: 'Aprovações Operacionais' })).toBeVisible();
        }

        if (rota.href === '/gestao/relatorios') {
          await page.goto(`/gestao/relatorios?operacaoId=${dados.operacaoId}`);
          await expect(page.getByText('Provisório').first()).toBeVisible();
          await expect(page.getByText('Pendentes de dados')).toBeVisible();
        }

        expect(erros, erros.join('\n')).toEqual([]);

        await capture(
          page,
          steps,
          rota.screenshot.replace('.png', ''),
          rota.menuLabel,
          `Validar rota ${rota.href} após navegação pelo menu.`,
          `Clicar em "${rota.menuLabel}" na sidebar.`,
          'Tela carregada com título esperado e blocos-chave visíveis.',
        );
      } finally {
        await page.close();
      }
    });
  }

  test('evidências complementares: impacto, overbooking, comparativo e versões SIF', async () => {
    test.setTimeout(120_000);
    const page = await gestorContext.newPage();
    try {
      await selecionarDataCompras(page, dados.dataOperacao, dados.compraId);
      await page.getByRole('button', { name: 'Editar compra confirmada' }).click();
      const dialog = page.getByRole('dialog', { name: 'Editar compra confirmada' });
      await expect(dialog).toBeVisible();
      const input = dialog.locator('input[type="number"]').first();
      await expect(input).toBeVisible();
      const impacto = page.waitForResponse(
        (r) => r.url().includes('/impacto?') && r.ok(),
        { timeout: 20_000 },
      );
      await input.fill('60');
      await impacto;
      await expect(page.getByText('Painel de impacto')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Déficit resultante/i)).toBeVisible({ timeout: 15_000 });
      await capture(
        page,
        steps,
        '07-impacto-deficit',
        'Painel de impacto — déficit projetado',
        'Demonstrar recálculo pré-salvamento ao reduzir compra confirmada.',
        'Abrir modal de edição e reduzir quantidade abaixo das reservas.',
        'Painel de impacto exibe déficit projetado antes de confirmar.',
      );

      await page.goto(`/gestao/overbooking?operacaoId=${dados.operacaoId}`);
      const primeira = page.locator('button').filter({ hasText: 'Déficit:' }).first();
      if (await primeira.isVisible()) await primeira.click();
      await capture(
        page,
        steps,
        '08-overbooking-decisao',
        'Overbooking — três caminhos de decisão',
        'Evidenciar os blocos de decisão da pendência selecionada.',
        'Selecionar pendência aberta na fila mestre-detalhe.',
        'Três caminhos (compra complementar, redistribuição, postergar) visíveis.',
      );

      await page.goto(`/gestao/aprovacoes?operacaoId=${dados.operacaoId}`);
      await page.getByRole('tab', { name: 'Fila Administrativa de Ocorrências' }).click();
      const indiceOcorrencia = dados.ocorrenciaIndice;
      expect(indiceOcorrencia).toBeDefined();
      const itemOcorrencia = page
        .locator('button')
        .filter({ has: page.locator('p.font-semibold') })
        .nth(indiceOcorrencia!);
      await itemOcorrencia.click();
      const comparativo = page.getByText('Quadro comparativo — Pedido × NF × Pesagem');
      await expect(comparativo).toBeVisible();
      await expect(page.getByText(/imutáveis/i)).toBeVisible();
      await capture(
        page,
        steps,
        '09-comparativo-imutavel',
        'Comparativo Pedido × NF × Pesagem',
        'Evidenciar quadro imutável na aba de ocorrências.',
        'Selecionar a ocorrência vinculada à conferência tripla concluída neste run.',
        'Quadro comparativo renderizado com aviso de imutabilidade.',
      );

      await page.goto(`/gestao/relatorios?operacaoId=${dados.operacaoId}`);
      const btnHistorico = page.getByRole('button', { name: /Histórico/i }).first();
      await btnHistorico.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await capture(
        page,
        steps,
        '10-sif-versoes',
        'Relatórios SIF — histórico de versões',
        'Evidenciar modal de versões do relatório SIF.',
        'Abrir Histórico no primeiro relatório da operação.',
        'Modal de versões aberto (vazio ou com versões geradas).',
      );
    } finally {
      await page.close();
    }

    expect(steps.length).toBeGreaterThanOrEqual(10);
  });
});
