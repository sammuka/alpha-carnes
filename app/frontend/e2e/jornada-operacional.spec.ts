/**
 * Jornada E2E narrativa — AlphaCarnes
 *
 * Exercita a aplicação com dados reais no banco atual:
 * cadastros pela UI, pré-condições ainda sem tela via API, operação em tela
 * e relatório HTML com evidências visuais.
 */

import { test, expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
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
    if (!key) continue;

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

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])];
}

const BASE_URL = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3100';
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? BACKEND_ENV.SEED_ADMIN_EMAIL ?? ROOT_ENV.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const ADMIN_PASSWORDS = uniqueStrings([
  process.env.SEED_ADMIN_PASSWORD,
  BACKEND_ENV.SEED_ADMIN_PASSWORD,
  ROOT_ENV.SEED_ADMIN_PASSWORD,
  'change-me-admin-password',
  'Admin@AlphaCarnes2026!',
]);

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const EVIDENCE_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'alpha-jornada-e2e');

interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface CadastroRegistro {
  id: string;
  codigo: string;
  razaoSocial?: string;
  descricao?: string;
  documentoFiscal?: string;
}

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

interface RunContext {
  runId: string;
  dataOperacao: string;
  clienteId: string;
  fornecedorId: string;
  itemCompraId: string;
  itemComercialId: string;
  compraProgramadaId: string;
  pedidoVendaId: string;
  recebimentoId: string;
  pecaId: string;
  pecaCorteId: string;
  limiteAtivo: 'para_corte';
}

type PecaNoHandoff = { id: string; statusPeca: string };

function ensureCleanDirs() {
  fs.rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
  fs.rmSync(EVIDENCE_DIR, { recursive: true, force: true });
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  // Fallback para inputs controlados que ignoram fill nativo do Playwright.
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
}

/**
 * Seleciona uma data ISO (`yyyy-MM-dd`) num `DatePickerField` (trigger `<button>` +
 * Popover com `react-day-picker`). Não dá para usar `.fill()` — precisa navegar o
 * calendário até o mês certo e clicar no dia.
 */
async function selecionarDataNoPicker(page: Page, selector: string, isoDate: string) {
  await page.locator(selector).click();

  const popover = page.locator('[data-slot="popover-content"]');
  await expect(popover).toBeVisible();

  const [ano, mes, dia] = isoDate.split('-').map(Number);
  const hoje = new Date();
  // Sem data selecionada, o Calendar abre no mês atual (defaultMonth={selected} == undefined).
  const diffMeses = (ano - hoje.getFullYear()) * 12 + (mes - 1 - hoje.getMonth());
  const botaoNavegacao = popover.getByRole('button', {
    name: diffMeses >= 0 ? 'Go to next month' : 'Go to previous month',
  });
  for (let i = 0; i < Math.abs(diffMeses); i += 1) {
    await botaoNavegacao.click();
  }

  // Exclui dias de mês adjacente ("outside day"), que reaproveitam a classe
  // `text-fg-faint` (ver classNames.day_outside em calendar.tsx).
  const diaCell = popover
    .getByRole('gridcell', { name: String(dia), exact: true })
    .and(popover.locator(':not(.text-fg-faint)'));
  await diaCell.click();

  await expect(popover).toBeHidden();
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

async function waitIdle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
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
  await waitIdle(page);
  const fileName = `${id}.png`;
  const source = path.join(SCREENSHOTS_DIR, fileName);
  const target = path.join(EVIDENCE_DIR, fileName);
  await page.screenshot({ path: source, fullPage: true });
  fs.copyFileSync(source, target);
  steps.push({ id, title, url: page.url(), objective, action, result, screenshot: fileName, note });
}

function cookieHeaderFromResponse(res: APIResponse): string {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0])
    .join('; ');
}

async function parseJson<T>(res: APIResponse): Promise<T> {
  return (await res.json().catch(async () => ({ raw: await res.text() }))) as T;
}

async function loginBackend(api: APIRequestContext): Promise<{ cookieHeader: string; password: string }> {
  const errors: string[] = [];
  for (const password of ADMIN_PASSWORDS) {
    const res = await api.post(`${BACKEND_URL}/auth/login`, {
      data: { email: ADMIN_EMAIL, password },
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok()) {
      return { cookieHeader: cookieHeaderFromResponse(res), password };
    }
    errors.push(`${res.status()} ${await res.text().catch(() => '')}`);
  }
  throw new Error(`Não foi possível autenticar admin em ${BACKEND_URL}. Tentativas: ${errors.join(' | ')}`);
}

async function backend<T>(
  api: APIRequestContext,
  cookieHeader: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  route: string,
  body?: unknown,
): Promise<T> {
  const res = await api.fetch(`${BACKEND_URL}${route}`, {
    method,
    headers: {
      Cookie: cookieHeader,
      'Content-Type': 'application/json',
    },
    data: body,
  });
  const data = await parseJson<T | { message?: unknown }>(res);
  if (!res.ok()) {
    throw new Error(`${method} ${route} falhou (${res.status()}): ${JSON.stringify(data)}`);
  }
  return data as T;
}

async function findByCode(api: APIRequestContext, cookieHeader: string, recurso: string, codigo: string) {
  const qs = new URLSearchParams({ search: codigo, pageSize: '5' });
  const result = await backend<Paginado<CadastroRegistro>>(api, cookieHeader, 'GET', `/${recurso}?${qs.toString()}`);
  const found = result.data.find((item) => item.codigo === codigo);
  if (!found) throw new Error(`Registro ${recurso}/${codigo} não encontrado após criação`);
  return found.id;
}

async function createCadastroViaUi(
  page: Page,
  steps: StepEvidence[],
  options: {
    recurso: string;
    title: string;
    fields: Record<string, string>;
    checkboxLabels?: string[];
    screenshotId: string;
  },
) {
  await page.goto(`${BASE_URL}/cadastros/${options.recurso}/novo`);
  for (const [label, value] of Object.entries(options.fields)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  for (const label of options.checkboxLabels ?? []) {
    await page.getByLabel(label, { exact: true }).check();
  }
  const postPromise = page.waitForResponse(
    (res) =>
      res.url().includes(`/api/cadastros/${options.recurso}`) &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Criar' }).click();
  const postRes = await postPromise;
  expect(postRes.ok(), `POST ${options.recurso} falhou: ${postRes.status()} ${await postRes.text()}`).toBeTruthy();
  // Sai de /novo após persistência (evita falso positivo com /.../novo).
  await expect(page).not.toHaveURL(new RegExp(`/cadastros/${options.recurso}/novo`));
  await capture(
    page,
    steps,
    options.screenshotId,
    options.title,
    `Criar e listar ${options.title.toLowerCase()} usando a tela de cadastro.`,
    `Formulário preenchido e salvo em /cadastros/${options.recurso}/novo.`,
    'Registro criado e visível na listagem do módulo.',
  );
}

async function criarCompraConfirmada(
  api: APIRequestContext,
  cookieHeader: string,
  params: { fornecedorId: string; itemCompraId: string; runId: string },
) {
  for (let offset = 0; offset < 45; offset += 1) {
    const dataOperacao = addDaysISO(offset);
    const create = await api.post(`${BACKEND_URL}/comercial/compras-programadas`, {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      data: {
        dataOperacao,
        fornecedorId: params.fornecedorId,
        numeroInterno: `E2E-${params.runId}-${offset}`,
        observacoes: 'Compra programada criada pela jornada E2E visual',
        itens: [{ itemCompraId: params.itemCompraId, quantidadeComprada: 4 }],
      },
    });

    const createBody = await parseJson<{ id?: string; message?: unknown }>(create);
    if (create.status() === 409) continue;
    if (!create.ok() || !createBody.id) {
      throw new Error(`Falha ao criar compra em ${dataOperacao}: ${JSON.stringify(createBody)}`);
    }

    await backend(api, cookieHeader, 'POST', `/comercial/compras-programadas/${createBody.id}/confirmar`);
    return { compraProgramadaId: createBody.id, dataOperacao };
  }
  throw new Error('Não foi encontrada data operacional livre para compra programada E2E');
}

function writeReport(steps: StepEvidence[], context: RunContext, observations: string[]) {
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

  const ids = [
    ['Run ID', context.runId],
    ['Data operacional', context.dataOperacao],
    ['Cliente', context.clienteId],
    ['Fornecedor', context.fornecedorId],
    ['Item compra', context.itemCompraId],
    ['Item comercial', context.itemComercialId],
    ['Compra programada', context.compraProgramadaId],
    ['Pedido venda', context.pedidoVendaId],
    ['Recebimento', context.recebimentoId],
    ['Peça carga', context.pecaId],
    ['Peça no handoff', context.pecaCorteId],
    ['Limite ativo da Onda 4', context.limiteAtivo],
  ];

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AlphaCarnes - Jornada E2E Visual</title>
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
    table { width:100%; margin-top:16px; border-collapse:collapse; }
    th, td { border:1px solid var(--line); padding:10px; text-align:left; vertical-align:top; }
    th { color:var(--green); background:#111113; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
  </style>
</head>
<body>
  <header>
    <h1>AlphaCarnes - Jornada E2E Visual</h1>
    <p>Relatório gerado pela automação Playwright com dados inseridos no banco atual e telas capturadas no navegador Chromium.</p>
    <div class="badges">
      <span class="badge">${steps.length} telas capturadas</span>
      <span class="badge">Run ${escapeHtml(context.runId)}</span>
      <span class="badge">Data ${escapeHtml(context.dataOperacao)}</span>
    </div>
  </header>
  <main class="wrap">
    <section class="context">
      <h2>Rastreabilidade dos Dados</h2>
      <p>Limite ativo da Onda 4: para_corte</p>
      <div class="context-grid">
        ${ids.map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><p><code>${escapeHtml(value)}</code></p></div>`).join('')}
      </div>
    </section>
    <section class="coverage">
      <h2>Limite ativo e próximos handoffs</h2>
      <ul>
        <li>Onda 4 validada até o status para_corte: UI, API e evidência 11 sobre a mesma peça.</li>
      </ul>
      <table>
        <thead>
          <tr><th>Handoff futuro</th><th>Onda dona</th><th>Contrato futuro</th></tr>
        </thead>
        <tbody>
          <tr><td>Desossa</td><td>Onda 7 · matriz 17–19</td><td>Painel/Modo TV, regra exclusiva parametrizada, checklist, divergência, peça mãe, etiqueta e rastreabilidade ponta a ponta.</td></tr>
          <tr><td>Carga</td><td>Onda 9 · matriz 23–25</td><td>Planejamento, bipagem/conferência, congelamento após fechamento e envio para faturamento.</td></tr>
          <tr><td>Faturamento</td><td>Onda 10 · matriz 26–29</td><td>Adapter EISS/flag RTC, Notas/XML, Seguro F6b, liberação e checklist.</td></tr>
          <tr><td>Auditoria futura</td><td>DoD transversal das Ondas 7/9/10</td><td>A tela /admin/auditoria pertence à Onda 3 e não prova eventos que ainda não existem; cada onda dona deve testar suas mutações críticas.</td></tr>
        </tbody>
      </table>
    </section>
    ${observations.length > 0 ? `<section class="observations"><h2>Observações Técnicas</h2><ul>${observations.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul></section>` : ''}
    ${rows}
  </main>
</body>
</html>`;

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'index.html'), html, 'utf8');
}

test.describe('Jornada Operacional AlphaCarnes', () => {
  test.setTimeout(600_000);

  test('cria dados, executa a O4 ate o handoff para_corte e gera evidencia HTML', async ({ page, request }) => {
    ensureCleanDirs();

    const steps: StepEvidence[] = [];
    const observations: string[] = [];
    const caminhosVisitados: string[] = [];
    const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const seed = Number(runId.slice(-9));
    const codigo = (prefix: string) => `E2E-${prefix}-${runId}`;

    page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) observations.push(`Console ${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => observations.push(`Page error: ${err.message}`));
    page.on('response', (res) => {
      if (res.status() >= 500) observations.push(`HTTP ${res.status()}: ${res.url()}`);
    });
    page.on('requestfailed', (req) => observations.push(`Request failed: ${req.url()} - ${req.failure()?.errorText ?? 'unknown'}`));
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        caminhosVisitados.push(new URL(frame.url()).pathname);
      }
    });

    const auth = await loginBackend(request);

    await page.goto(`${BASE_URL}/login`);
    await capture(
      page,
      steps,
      '01-login',
      'Login',
      'Validar a identidade visual e o ponto de entrada autenticado.',
      'Abertura da rota /login antes de preencher credenciais.',
      'Tela de login renderizada com logo, e-mail, senha e botão de entrada.',
    );

    await page.getByLabel('E-mail').fill(ADMIN_EMAIL);
    await page.getByLabel('Senha').fill(auth.password);
    await page.getByRole('button', { name: 'Acessar Sistema' }).click();
    await expect(page.getByRole('heading', { name: 'Painel Geral da Operação' })).toBeVisible({ timeout: 15_000 });
    await capture(
      page,
      steps,
      '02-dashboard',
      'Painel Geral da Operação',
      'Confirmar autenticação, layout administrativo e navegação lateral.',
      'Login feito pela UI com usuário admin seedado.',
      'Dashboard carregado sem 404, com sidebar e indicadores operacionais.',
    );

    const clienteCodigo = codigo('CLI');
    const fornecedorCodigo = codigo('FORN');
    const itemCompraCodigo = codigo('ICOMP');
    const itemComercialCodigo = codigo('ICOM');

    await createCadastroViaUi(page, steps, {
      recurso: 'clientes',
      title: 'Cadastro de Clientes',
      fields: {
        Código: clienteCodigo,
        'Razão Social': `Cliente E2E ${runId}`,
        'Nome Fantasia': `Cliente ${runId}`,
        'CNPJ/CPF': makeCpf(seed + 1),
      },
      screenshotId: '03-clientes',
    });
    const clienteId = await findByCode(request, auth.cookieHeader, 'clientes', clienteCodigo);

    await createCadastroViaUi(page, steps, {
      recurso: 'fornecedores',
      title: 'Cadastro de Fornecedores',
      fields: {
        Código: fornecedorCodigo,
        'Razão Social': `Fornecedor E2E ${runId}`,
        'CNPJ/CPF': makeCpf(seed + 2),
      },
      screenshotId: '04-fornecedores',
    });
    const fornecedorId = await findByCode(request, auth.cookieHeader, 'fornecedores', fornecedorCodigo);

    await createCadastroViaUi(page, steps, {
      recurso: 'itens-compra',
      title: 'Cadastro de Itens de Compra',
      fields: {
        Código: itemCompraCodigo,
        Descrição: `Bovino E2E ${runId}`,
        Categoria: 'Bovino',
        'Unidade de Compra': 'cabeca',
      },
      screenshotId: '05-itens-compra',
    });
    const itemCompraId = await findByCode(request, auth.cookieHeader, 'itens-compra', itemCompraCodigo);

    await createCadastroViaUi(page, steps, {
      recurso: 'itens-comerciais',
      title: 'Cadastro de Itens Comerciais',
      fields: {
        Código: itemComercialCodigo,
        Descrição: `Dianteiro E2E ${runId}`,
        Categoria: 'Bovino',
        'Unidade Comercial': 'parte',
      },
      checkboxLabels: ['Permite Corte'],
      screenshotId: '06-itens-comerciais',
    });
    const itemComercialId = await findByCode(request, auth.cookieHeader, 'itens-comerciais', itemComercialCodigo);

    await backend(request, auth.cookieHeader, 'POST', '/regras-desdobramento', {
      itemCompraId,
      itemComercialId,
      fatorQuantidade: 1,
      status: 'ativo',
      vigenciaInicio: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      observacoes: 'Regra criada pela jornada E2E visual',
    });
    const compra = await criarCompraConfirmada(request, auth.cookieHeader, { fornecedorId, itemCompraId, runId });

    await page.goto(`${BASE_URL}/comercial/disponibilidade`);
    await selecionarDataNoPicker(page, '#data', compra.dataOperacao);
    await page.getByRole('button', { name: /^Grade$/ }).click();
    await expect(page.getByText(itemComercialCodigo, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await capture(
      page,
      steps,
      '07-disponibilidade',
      'Disponibilidade Comercial',
      'Validar saldo virtual gerado a partir de compra programada confirmada.',
      'Regra de desdobramento e compra confirmada foram criadas via API; a consulta foi feita em tela.',
      'A disponibilidade do item comercial aparece para a data operacional escolhida.',
      'Compra programada ainda não possui tela dedicada; por isso foi preparada via API autenticada.',
    );

    await page.goto(`${BASE_URL}/comercial/pedidos`);
    await page.getByRole('button', { name: 'Novo pedido' }).click();
    await page.locator('#pedido-operacao').selectOption(compra.compraProgramadaId);
    await page.locator('#pedido-cliente').click();
    await page.getByRole('option', { name: `Cliente ${runId}` }).click();
    await page.locator('#produto-novo').selectOption(itemComercialId);
    await page.locator('#quantidade-produto-novo').fill('2');
    await page.getByRole('button', { name: 'Adicionar produto' }).click();
    const pedidoResponse = page.waitForResponse((res) => res.url().includes('/api/comercial/pedidos') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Salvar Rascunho' }).click();
    const respostaPedido = await pedidoResponse;
    expect(respostaPedido.status()).toBeGreaterThanOrEqual(200);
    expect(respostaPedido.status()).toBeLessThan(300);
    expect(respostaPedido.request().postDataJSON()).toEqual(expect.objectContaining({
      compraProgramadaId: compra.compraProgramadaId,
      dataOperacao: compra.dataOperacao,
    }));
    expect(respostaPedido.request().postDataJSON().dataOperacao).toBeDefined();
    const pedido = (await respostaPedido.json()) as { id: string; status: string };
    const artigoPedido = page.locator('tr').filter({ hasText: pedido.id.slice(0, 8).toUpperCase() });
    await expect(
      artigoPedido.locator('span', { hasText: /^Rascunho com reserva ativa$/ }),
    ).toBeVisible();
    await capture(
      page,
      steps,
      '08-pedido',
      'Pedido de Venda',
      'Criar pedido com reserva de saldo virtual.',
      'Preenchimento manual dos IDs técnicos exigidos pela tela atual.',
      `Pedido criado com status ${pedido.status}.`,
      'A UX atual ainda exige UUIDs; o relatório registra esse ponto para evolução posterior.',
    );
    const pedidoFornecedor = await backend<{ id: string; numero: string }>(
      request,
      auth.cookieHeader,
      'POST',
      '/operacao/pedidos-fornecedor',
      { compraProgramadaId: compra.compraProgramadaId },
    );
    await backend(
      request,
      auth.cookieHeader,
      'POST',
      `/operacao/pedidos-fornecedor/${pedidoFornecedor.id}/enviar`,
    );

    await page.goto(`${BASE_URL}/recebimento/recebimento-carga`);
    await page.getByTestId('btn-novo-recebimento').click();
    const novoRecebimento = page.getByRole('dialog', { name: 'Novo Recebimento de Carga' });
    const pedidoCombobox = novoRecebimento.getByRole('combobox', {
      name: 'Pedido ao fornecedor',
    });
    await pedidoCombobox.click();
    const pedidoOption = page.getByRole('option', {
      name: new RegExp(pedidoFornecedor.numero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });
    await expect(pedidoOption).toBeVisible();
    await pedidoOption.click();
    await expect(pedidoCombobox).toContainText(pedidoFornecedor.numero);
    await expect(novoRecebimento.getByText(pedidoFornecedor.numero, { exact: false })).toBeVisible();
    await novoRecebimento.locator('#nfeNumero').fill(`NF-E2E-${runId}`);
    const recebimentoResponse = page.waitForResponse((res) => res.url().includes('/api/operacao/recebimentos') && res.request().method() === 'POST');
    await novoRecebimento.getByTestId('btn-criar-ir-balanca').click();
    const respostaRecebimento = await recebimentoResponse;
    expect(respostaRecebimento.status()).toBe(201);
    expect(respostaRecebimento.request().postDataJSON()).toEqual(expect.objectContaining({
      pedidoFornecedorId: pedidoFornecedor.id,
    }));
    expect(respostaRecebimento.request().postDataJSON()).not.toHaveProperty('compraProgramadaId');
    const recebimentoBody = (await respostaRecebimento.json()) as {
      recebimento: { id: string };
      jaIniciado: false;
    };
    expect(recebimentoBody.jaIniciado).toBe(false);
    expect(recebimentoBody.recebimento.id).toBeTruthy();
    const recebimentoId = recebimentoBody.recebimento.id;
    await expect(page).toHaveURL(new RegExp(`/recebimento/pesagem-destinacao\\?recebimentoId=${recebimentoId}`));
    await expect(page.getByTestId('status-dispositivos')).toContainText('Balança');
    await capture(
      page,
      steps,
      '09-recebimento',
      'Recebimento e Balança',
      'Criar lote de recebimento pela tela vigente e encaminhar para a balança.',
      `Pedido ao Fornecedor ${pedidoFornecedor.numero} foi selecionado e a NF-e informada no novo recebimento.`,
      'Lote criado e aberto na tela de Pesagem e Destinação.',
    );

    const pecaResponse = page.waitForResponse((res) => res.url().includes('/api/operacao/pesagem/pecas') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Capturar Peso' }).click();
    const peca = (await (await pecaResponse).json()) as { id: string };
    await page.getByRole('button', { name: 'Vincular' }).click();
    await expect(page.getByTestId('peca-status')).toContainText('associada', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Confirmar e imprimir etiqueta' }).click();
    await expect(page.getByRole('button', { name: /Etiqueta: QR-/ })).toBeVisible({ timeout: 10_000 });
    await capture(
      page,
      steps,
      '10-pesagem-associada',
      'Pesagem, Associação e Etiqueta',
      'Capturar peso automático, aceitar sugestão e emitir etiqueta QR.',
      'Peça pesada pelo gateway fake, associada ao item do pedido e etiquetada.',
      'Peça ficou elegível para expedição.',
    );

    const pecaCorteResponse = page.waitForResponse((res) => res.url().includes('/api/operacao/pesagem/pecas') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Capturar Peso' }).click();
    const pecaCorte = (await (await pecaCorteResponse).json()) as { id: string };
    await expect(page.getByTestId('peca-status')).toContainText('pesada', { timeout: 10_000 });
    await page.getByTestId('peca-atual').getByRole('button', { name: 'Desossa' }).click();
    await expect(page.getByTestId('peca-status')).toContainText('para_corte', { timeout: 10_000 });
    const pecaNoHandoff = await backend<PecaNoHandoff>(
      request,
      auth.cookieHeader,
      'GET',
      `/operacao/pesagem/pecas/${pecaCorte.id}`,
    );
    expect(pecaNoHandoff).toEqual(expect.objectContaining({
      id: pecaCorte.id,
      statusPeca: 'para_corte',
    }));
    await expect(page).toHaveURL(
      new RegExp(`/recebimento/pesagem-destinacao\\?recebimentoId=${recebimentoId}`),
    );
    await page.getByRole('button', { name: 'Confirmar e imprimir etiqueta' }).click();
    await capture(
      page,
      steps,
      '11-pesagem-para-corte',
      'Handoff para Desossa',
      'Provar o último estado real da Onda 4 antes da Desossa.',
      'A segunda peça foi pesada e destinada à Desossa pela UI; a API canônica foi relida.',
      'Peça confirmada em para_corte na UI e na API. A continuação pertence à Onda 7.',
    );

    const caminhosFuturos = [
      ['desossa'],
      ['carga'],
      ['faturamento'],
      ['operacao', 'corte'],
      ['operacao', 'expedicao'],
      ['operacao', 'faturamento'],
    ].map((partes) => `/${partes.join('/')}`);

    const navegacoesFuturas = caminhosVisitados.filter((caminho) =>
      caminhosFuturos.some((prefixo) =>
        caminho === prefixo || caminho.startsWith(`${prefixo}/`),
      ),
    );
    expect(navegacoesFuturas).toEqual([]);
    expect(steps).toHaveLength(11);

    writeReport(
      steps,
      {
        runId,
        dataOperacao: compra.dataOperacao,
        clienteId,
        fornecedorId,
        itemCompraId,
        itemComercialId,
        compraProgramadaId: compra.compraProgramadaId,
        pedidoVendaId: pedido.id,
        recebimentoId,
        pecaId: peca.id,
        pecaCorteId: pecaCorte.id,
        limiteAtivo: 'para_corte',
      },
      observations,
    );

    const relatorioPath = path.join(EVIDENCE_DIR, 'index.html');
    expect(fs.existsSync(relatorioPath)).toBe(true);
    const relatorio = fs.readFileSync(relatorioPath, 'utf8');
    expect((relatorio.match(/<section class="step"/g) ?? [])).toHaveLength(11);
    expect(relatorio).toContain('Limite ativo da Onda 4: para_corte');
    expect(relatorio).toContain('11-pesagem-para-corte.png');
    expect(relatorio).not.toMatch(
      /(?:src|id)="(?:12|13|14|15|16|17|18|19)-/,
    );
  });
});

// D35: contrato estático da fronteira
test('contrato estatico impede a jornada O4 de atravessar ondas futuras', async () => {
  const arquivo = fs.readFileSync(__filename, 'utf8');
  const fonteDaJornada = arquivo.split('// D35: contrato estático da fronteira')[0] ?? '';
  const escaparRegex = (valor: string) =>
    valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const caminhos = [
    ['operacao', 'corte'],
    ['operacao', 'expedicao'],
    ['operacao', 'faturamento'],
    ['desossa'],
    ['carga'],
    ['faturamento'],
  ].map((partes) => `/${partes.join('/')}`);
  for (const caminho of caminhos) {
    expect(fonteDaJornada).not.toMatch(
      new RegExp(`page\\.goto\\([^\\n]*${escaparRegex(caminho)}`),
    );
  }

  const namespacesApi = [
    ['operacao', 'corte'],
    ['operacao', 'expedicao'],
    ['operacao', 'faturamento'],
  ].map((partes) => `/${partes.join('/')}`);
  for (const namespace of namespacesApi) {
    expect(fonteDaJornada).not.toMatch(
      new RegExp(`backend[\\s\\S]{0,320}${escaparRegex(namespace)}`),
    );
  }

  expect(fonteDaJornada).not.toMatch(
    new RegExp(`\\b${['subitem', 'Id'].join('')}\\b`),
  );
  expect(fonteDaJornada).not.toMatch(
    new RegExp(`\\b${['caminhao', 'Id'].join('')}\\b`),
  );
});
