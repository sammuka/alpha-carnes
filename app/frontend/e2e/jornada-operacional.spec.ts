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

interface PedidoDetalhe {
  id: string;
  itens: Array<{ id: string }>;
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
  pedidoVendaItemId: string;
  recebimentoId: string;
  pecaId: string;
  pecaCorteId: string;
  subitemId: string;
  caminhaoId: string;
}

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
  await input.evaluate((node, nextValue) => {
    const element = node as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, nextValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await expect(input).toHaveValue(value);
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
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page).toHaveURL(new RegExp(`/cadastros/${options.recurso}`));
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
    ['Peça corte', context.pecaCorteId],
    ['Subitem', context.subitemId],
    ['Caminhão', context.caminhaoId],
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
      <div class="context-grid">
        ${ids.map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><p><code>${escapeHtml(value)}</code></p></div>`).join('')}
      </div>
    </section>
    <section class="coverage">
      <h2>Cobertura e Lacunas</h2>
      <ul>
        <li>Validado em tela: login, dashboard, cadastros, disponibilidade, pedido, recebimento, pesagem, corte, expedição, detalhe de caminhão, faturamento e auditoria.</li>
        <li>Preparado por API por ainda não haver tela dedicada: regra de desdobramento, compra programada, vínculo/carga/conferência/fechamento de expedição.</li>
        <li>Auditoria ainda é tela informativa; o backend registra eventos, mas a visualização filtrável segue pendente.</li>
      </ul>
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

  test('cria dados, executa fluxos implementados e gera evidência HTML', async ({ page, request }) => {
    ensureCleanDirs();

    const steps: StepEvidence[] = [];
    const observations: string[] = [];
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
    await page.getByRole('button', { name: 'Entrar' }).click();
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
    await fillInputValue(page, '#data', compra.dataOperacao);
    await expect(page.getByText(itemComercialId)).toBeVisible({ timeout: 15_000 });
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

    await page.goto(`${BASE_URL}/comercial/pedidos/novo`);
    await page.locator('#compraProgramadaId').fill(compra.compraProgramadaId);
    await page.locator('#clienteId').fill(clienteId);
    await fillInputValue(page, '#dataOperacao', compra.dataOperacao);
    await page.locator('#itemComercialId').fill(itemComercialId);
    await page.locator('#quantidadePedida').fill('2');
    const pedidoResponse = page.waitForResponse((res) => res.url().includes('/api/comercial/pedidos') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Criar pedido' }).click();
    const pedido = (await (await pedidoResponse).json()) as { id: string; status: string };
    await expect(page.getByRole('status')).toContainText('Pedido criado');
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
    const pedidoDetalhe = await backend<PedidoDetalhe>(request, auth.cookieHeader, 'GET', `/comercial/pedidos/${pedido.id}`);
    const pedidoVendaItemId = pedidoDetalhe.itens[0]?.id;
    if (!pedidoVendaItemId) throw new Error('Pedido criado sem item retornado no detalhe');

    await page.goto(`${BASE_URL}/operacao/recebimento`);
    await page.locator('#compra').fill(compra.compraProgramadaId);
    const recebimentoResponse = page.waitForResponse((res) => res.url().includes('/api/operacao/recebimentos') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Iniciar recebimento' }).click();
    const recebimentoBody = (await (await recebimentoResponse).json()) as { recebimento: { id: string } };
    const recebimentoId = recebimentoBody.recebimento.id;
    await expect(page.getByTestId('receb-status')).toContainText('em_andamento');
    await page.getByLabel(`Quantidade recebida ${itemComercialId}`).fill('4');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByText('conforme')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('btn-concluir').click();
    await expect(page.getByTestId('receb-status')).toContainText('concluido', { timeout: 10_000 });
    await capture(
      page,
      steps,
      '09-recebimento',
      'Recebimento',
      'Iniciar recebimento, conferir item esperado e concluir sem divergência.',
      'Compra confirmada informada na tela; quantidade recebida igual à esperada.',
      'Recebimento concluído e disponibilidade física atualizada.',
    );

    await page.goto(`${BASE_URL}/operacao/pesagem`);
    await expect(page.getByText('Balança: disponivel')).toBeVisible({ timeout: 15_000 });
    await page.locator('#receb').fill(recebimentoId);
    await page.locator('#item').fill(itemComercialId);
    await fillInputValue(page, '#data', compra.dataOperacao);

    const pecaResponse = page.waitForResponse((res) => res.url().includes('/api/operacao/pesagem/pecas') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Capturar peso automático' }).click();
    const peca = (await (await pecaResponse).json()) as { id: string };
    await page.getByRole('button', { name: 'Sugerir pedido' }).click();
    await expect(page.getByText('Sugerido: pedido')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Confirmar associação' }).click();
    await expect(page.getByTestId('peca-status')).toContainText('associada', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Emitir etiqueta' }).click();
    await expect(page.getByTestId('etiqueta-atual')).toContainText('QR-', { timeout: 10_000 });
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
    await page.getByRole('button', { name: 'Capturar peso automático' }).click();
    const pecaCorte = (await (await pecaCorteResponse).json()) as { id: string };
    await expect(page.getByTestId('peca-status')).toContainText('pesada', { timeout: 10_000 });
    await capture(
      page,
      steps,
      '11-pesagem-para-corte',
      'Peça Pesada para Corte',
      'Gerar uma segunda peça para validar o fluxo de transformação.',
      'Nova captura automática sobre o mesmo recebimento e item comercial.',
      'Peça ficou no status pesada, pronta para ser cortada.',
    );

    await page.goto(`${BASE_URL}/operacao/corte`);
    await expect(page.getByText('Balança: disponivel')).toBeVisible({ timeout: 15_000 });
    await page.locator('#pecaId').fill(pecaCorte.id);
    await fillInputValue(page, '#dataOp', compra.dataOperacao);
    await page.getByRole('button', { name: 'Iniciar corte' }).click();
    await expect(page.getByTestId('corte-atual')).toBeVisible({ timeout: 10_000 });
    await page.locator('#itemComercialSubitem').fill(itemComercialId);
    const subitemResponse = page.waitForResponse((res) => res.url().includes('/api/operacao/corte/') && res.url().includes('/subitens') && res.request().method() === 'POST');
    await page.getByRole('button', { name: '+ Adicionar subitem' }).click();
    const subitem = (await (await subitemResponse).json()) as { id: string };
    await page.getByRole('button', { name: 'Pesar automático' }).click();
    await expect(page.getByTestId('subitem-status')).toContainText('pesado', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Sugerir pedido' }).click();
    await page.getByLabel(`Item do pedido ${subitem.id}`).fill(pedidoVendaItemId);
    await page.getByRole('button', { name: 'Associar' }).click();
    await expect(page.getByTestId('subitem-status')).toContainText('associado', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Emitir etiqueta' }).click();
    await expect(page.getByText('QR-SUB-')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Concluir corte' }).click();
    await expect(page.getByText('Transformação concluída')).toBeVisible({ timeout: 10_000 });
    await capture(
      page,
      steps,
      '12-corte',
      'Corte e Transformação',
      'Transformar uma peça em subitem, pesar, associar, etiquetar e concluir.',
      'Subitem criado com o item comercial correto e associado ao pedido por sugestão/ID.',
      'Transformação concluída com rastreabilidade da peça de origem para o subitem.',
    );

    const caminhao = await backend<{ id: string }>(request, auth.cookieHeader, 'POST', '/operacao/expedicao/caminhoes', {
      placa: `E2E${runId.slice(-4)}`,
      motorista: 'Motorista E2E',
      rota: 'Rota E2E Osasco',
      dataOperacao: compra.dataOperacao,
    });
    await backend(request, auth.cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/pedidos`, {
      pedidoVendaId: pedido.id,
      ordemNaCarga: 1,
    });

    await page.goto(`${BASE_URL}/operacao/expedicao`);
    await fillInputValue(page, '#data-operacao', compra.dataOperacao);
    await expect(page.getByText('Motorista E2E')).toBeVisible({ timeout: 15_000 });
    await capture(
      page,
      steps,
      '13-expedicao-planejada',
      'Expedição Planejada',
      'Listar caminhão criado para a data operacional da jornada.',
      'Caminhão e vínculo com pedido foram preparados via API; a tela filtra a data escolhida.',
      'Caminhão aparece em tela com status planejado e ação para abrir carga.',
      'A criação de caminhão e vínculo de pedido ainda não possuem formulário dedicado.',
    );
    await page.getByTestId('btn-abrir-carga').click();
    await expect(page.getByTestId('status-badge')).toContainText('em carga', { timeout: 10_000 });

    await backend(request, auth.cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/itens`, {
      tipoOrigem: 'peca',
      id: peca.id,
    });
    await backend(request, auth.cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/itens`, {
      tipoOrigem: 'subitem',
      id: subitem.id,
    });
    await backend(request, auth.cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/conferencia/iniciar`);
    await backend(request, auth.cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/conferencia/registrar-item`, {
      tipoOrigem: 'peca',
      modoCaptura: 'manual_assistido',
      codigo: `QR-${peca.id}`,
      motivo: 'Conferência E2E por código impresso',
    });
    await backend(request, auth.cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/conferencia/registrar-item`, {
      tipoOrigem: 'subitem',
      modoCaptura: 'manual_assistido',
      codigo: `QR-SUB-${subitem.id}`,
      motivo: 'Conferência E2E por código impresso',
    });
    await backend(request, auth.cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/conferencia/concluir`);
    await backend(request, auth.cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/fechar`, {});
    await page.goto(`${BASE_URL}/operacao/expedicao`);
    await fillInputValue(page, '#data-operacao', compra.dataOperacao);
    await expect(page.getByTestId('status-badge')).toContainText('fechado', { timeout: 15_000 });
    await capture(
      page,
      steps,
      '14-expedicao-fechada',
      'Expedição Fechada',
      'Validar reflexo em tela após carga, conferência e fechamento.',
      'Itens foram carregados e conferidos via API autenticada por falta de tela de detalhe operacional completa.',
      'Caminhão aparece fechado, pronto para faturamento.',
    );

    await page.getByTestId('link-detalhe').click();
    await expect(page.getByRole('heading', { name: /Caminhão/ })).toBeVisible({ timeout: 10_000 });
    await capture(
      page,
      steps,
      '15-expedicao-detalhe',
      'Detalhe do Caminhão',
      'Abrir a rota de detalhe exposta pela listagem de expedição.',
      'Clique no link Ver detalhe do caminhão.',
      'Página de detalhe carrega status, pedido vinculado, previsto e carregado.',
    );

    await page.goto(`${BASE_URL}/operacao/faturamento`);
    await page.locator('#caminhao-id').fill(caminhao.id);
    await page.getByRole('button', { name: 'Consolidar' }).click();
    await expect(page.getByTestId('lista-pedidos')).toBeVisible({ timeout: 15_000 });
    await capture(
      page,
      steps,
      '16-faturamento-consolidado',
      'Faturamento Consolidado',
      'Consolidar caminhão fechado e listar pedidos faturáveis.',
      'ID do caminhão informado na tela de faturamento.',
      'Pedido aparece consolidado, sem bloqueios críticos.',
    );

    await page.getByLabel('Valor (R$)').fill('1500.00');
    await page.getByRole('button', { name: 'Emitir NFS-e' }).click();
    await expect(page.getByText('NFS-e nº')).toBeVisible({ timeout: 20_000 });
    await capture(
      page,
      steps,
      '17-nfse-emitida',
      'NFS-e Emitida',
      'Emitir NFS-e pelo gateway fake determinístico.',
      'Valor informado e ação Emitir NFS-e executada na UI.',
      'Nota emitida com número e código de verificação fake.',
    );

    await page.getByLabel('Motivo do cancelamento').fill('Cancelamento validado pela jornada E2E');
    await page.getByTestId('btn-cancelar').click();
    await expect(page.getByText('cancelada')).toBeVisible({ timeout: 15_000 });
    await capture(
      page,
      steps,
      '18-nfse-cancelada',
      'NFS-e Cancelada',
      'Validar cancelamento auditável de NFS-e emitida.',
      'Motivo de cancelamento preenchido e ação Cancelar executada.',
      'Nota fiscal passou para status cancelada.',
    );

    await page.goto(`${BASE_URL}/admin/auditoria`);
    await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible({ timeout: 10_000 });
    await capture(
      page,
      steps,
      '19-auditoria',
      'Auditoria',
      'Registrar o estado atual da tela administrativa de auditoria.',
      'Abertura da rota /admin/auditoria.',
      'Tela informativa carregada; listagem filtrável de eventos ainda está pendente.',
      'O backend registra auditoria nas mutações; a UI ainda é placeholder.',
    );

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
        pedidoVendaItemId,
        recebimentoId,
        pecaId: peca.id,
        pecaCorteId: pecaCorte.id,
        subitemId: subitem.id,
        caminhaoId: caminhao.id,
      },
      observations,
    );

    expect(fs.existsSync(path.join(EVIDENCE_DIR, 'index.html'))).toBe(true);
  });
});
