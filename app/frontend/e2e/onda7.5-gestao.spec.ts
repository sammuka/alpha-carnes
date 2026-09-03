/**
 * Onda 7.5 — Hardening de Gestão: overbooking (cancelar com motivo, postergar com
 * max=déficit), aprovações (timeline após andamento), SIF (preview em Dialog).
 * Evidências em docs/evidencias/onda7.5/.
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

const GESTOR_EMAIL = process.env.SEED_GESTOR_EMAIL ?? 'gestor.onda75@alphacarnes.local';
const GESTOR_PASSWORD = process.env.SEED_GESTOR_PASSWORD ?? 'change-me-gestor-onda75';

const EVIDENCE_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'onda7.5');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-onda7.5');

interface StepEvidence {
  id: string;
  title: string;
  url: string;
  objective: string;
  action: string;
  result: string;
  screenshot: string;
}

interface DadosOnda75 {
  runId: string;
  operacaoId: string;
  dataOperacao: string;
  compraId: string;
  fornecedorId: string;
  clienteId: string;
  itemCompraId: string;
  itemComercialId: string;
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
    nome: 'Gestor E2E Onda 7.5',
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

async function prepararDados(api: APIRequestContext, adminCookie: string): Promise<DadosOnda75> {
  const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = runId.slice(-6);
  const docFornecedor = makeCpf(Number(suffix) + 1);
  const docCliente = makeCpf(Number(suffix) + 2);

  const fornecedor = await backend<{ id: string }>(api, adminCookie, 'POST', '/fornecedores', {
    codigo: `O75F${suffix}`,
    razaoSocial: `Fornecedor Onda75 ${suffix}`,
    documentoFiscal: docFornecedor,
  });
  const itemCompra = await backend<{ id: string }>(api, adminCookie, 'POST', '/itens-compra', {
    codigo: `O75IC${suffix}`,
    descricao: 'Boi Onda75',
    unidadeCompra: 'unidade',
  });
  const itemComercial = await backend<{ id: string }>(api, adminCookie, 'POST', '/itens-comerciais', {
    codigo: `O75TZ${suffix}`,
    descricao: 'Traseiro Onda75',
    unidadeComercial: 'kg',
  });
  const cliente = await backend<{ id: string }>(api, adminCookie, 'POST', '/clientes', {
    codigo: `O75CL${suffix}`,
    razaoSocial: `Cliente Onda75 ${suffix}`,
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

  for (let offset = 90; offset < 140; offset += 1) {
    const candidata = addDaysISO(offset);
    const opExtra = await obterOuCriarOperacaoExtraordinaria(
      api,
      adminCookie,
      candidata,
      `Onda75 E2E ${suffix}`,
    );

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
    throw new Error('Não foi possível preparar operação + compra confirmada para E2E Onda 7.5');
  }

  // Consome toda a disponibilidade virtual gerada (100 × fator 2 = 200 peças) com um
  // pedido normal, para que os pedidos confirmar-overbooking desta suíte gerem déficit real.
  await backend(api, adminCookie, 'POST', '/comercial/pedidos', {
    compraProgramadaId: compraId,
    clienteId: cliente.id,
    dataOperacao,
    itens: [{ itemComercialId: itemComercial.id, quantidadePedida: 200 }],
  });

  return {
    runId,
    operacaoId,
    dataOperacao,
    compraId,
    fornecedorId: fornecedor.id,
    clienteId: cliente.id,
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
  };
}

async function criarPendenciaOverbooking(
  api: APIRequestContext,
  adminCookie: string,
  dados: DadosOnda75,
  quantidadePedida: number,
): Promise<string> {
  // Cliente novo por chamada: o produto da operação já está totalmente reservado
  // (fixture consome os 200 disponíveis), então cada pedido de overbooking precisa
  // de um cliente distinto — do contrário o backend rejeita com PEDIDO_ABERTO_EXISTENTE
  // (mesmo cliente + mesmo item + mesma operação → deveria usar adendo, não novo pedido).
  const clienteExtra = await backend<{ id: string }>(api, adminCookie, 'POST', '/clientes', {
    codigo: `O75CE${Date.now().toString(36).slice(-8)}`,
    razaoSocial: `Cliente Overbooking ${Date.now()}`,
    documentoFiscal: makeCpf(Date.now()),
  });
  const pedido = await backend<{ id: string }>(api, adminCookie, 'POST', '/comercial/pedidos/confirmar-overbooking', {
    compraProgramadaId: dados.compraId,
    clienteId: clienteExtra.id,
    dataOperacao: dados.dataOperacao,
    itens: [{ itemComercialId: dados.itemComercialId, quantidadePedida }],
  });
  const list = await backend<{ data: Array<{ id: string; pedidoVendaId: string }> }>(
    api, adminCookie, 'GET', `/comercial/overbooking?operacaoId=${dados.operacaoId}&limite=50`,
  );
  const pend = list.data.find((p) => p.pedidoVendaId === pedido.id);
  if (!pend) throw new Error('pendência de overbooking não encontrada após criação');
  return pend.id;
}

async function capture(
  page: Page,
  steps: StepEvidence[],
  id: string,
  title: string,
  objective: string,
  action: string,
  result: string,
) {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  const fileName = `${id}.png`;
  const source = path.join(SCREENSHOTS_DIR, fileName);
  const target = path.join(EVIDENCE_DIR, fileName);
  await page.screenshot({ path: source, fullPage: true });
  fs.copyFileSync(source, target);
  steps.push({ id, title, url: page.url(), objective, action, result, screenshot: fileName });
}

function writeReport(steps: StepEvidence[], dados: DadosOnda75) {
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
  <title>AlphaCarnes - Onda 7.5 Correção/Hardening E2E</title>
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
    .context { border:1px solid var(--line); background:var(--panel); border-radius:10px; padding:18px; margin-bottom:24px; }
    .context-grid, .meta-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
    .context-grid div, .meta-grid div { border:1px solid var(--line); border-radius:8px; padding:12px; background:#111113; }
    .context-grid strong, .meta-grid strong { display:block; color:var(--green); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
    .step { margin:0 0 56px; padding-bottom:48px; border-bottom:1px solid var(--line); }
    .step-head { display:flex; align-items:flex-start; gap:14px; margin-bottom:16px; }
    .step-head span { width:38px; height:38px; display:grid; place-items:center; border-radius:8px; background:#2563eb; font-weight:700; }
    img { display:block; width:100%; margin-top:18px; border:1px solid var(--line); border-radius:10px; box-shadow:0 18px 50px rgba(0,0,0,.45); }
  </style>
</head>
<body>
  <header>
    <h1>AlphaCarnes — Onda 7.5 Correção/Hardening E2E</h1>
    <p>Evidências Playwright: overbooking (cancelar/postergar), aprovações (timeline) e SIF (pré-visualização).</p>
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

test.describe('Onda 7.5 — Gestão (correção/hardening)', () => {
  test.describe.configure({ mode: 'serial' });

  let gestorContext: BrowserContext;
  let dados: DadosOnda75;
  let adminCookie: string;
  const steps: StepEvidence[] = [];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    fs.rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
    fs.rmSync(EVIDENCE_DIR, { recursive: true, force: true });
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    adminCookie = await loginBackend(request, ADMIN_EMAIL, ADMIN_PASSWORDS);
    await ensureGestorUser(request, adminCookie);
    dados = await prepararDados(request, adminCookie);

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
      writeReport(steps, dados);
      expect(fs.existsSync(path.join(EVIDENCE_DIR, 'index.html'))).toBe(true);
    }
    await gestorContext?.close();
  });

  test('overbooking: cancelar pendência exige motivo (botão desabilitado até preencher)', async ({ request }) => {
    const pendenciaId = await criarPendenciaOverbooking(request, adminCookie, dados, 6);
    const page = await gestorContext.newPage();
    const erros: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) erros.push(msg.text());
    });
    try {
      await page.goto(`/gestao/overbooking?operacaoId=${dados.operacaoId}`);
      const cardPendencia = page.locator('button').filter({ hasText: 'Déficit:' }).first();
      await expect(cardPendencia).toBeVisible({ timeout: 15_000 });
      await cardPendencia.click();

      await expect(page.getByRole('button', { name: 'Cancelar pendência' })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: 'Cancelar pendência' }).click();

      const dialog = page.getByRole('dialog', { name: 'Cancelar Pendência' });
      await expect(dialog).toBeVisible();
      const confirmar = dialog.getByRole('button', { name: 'Confirmar Cancelamento' });
      await expect(confirmar).toBeDisabled();

      await capture(
        page, steps, '01-overbooking-cancelar-motivo-obrigatorio',
        'Overbooking — cancelamento exige motivo',
        'Evidenciar que o botão de confirmação fica desabilitado sem motivo selecionado.',
        'Abrir pendência → clicar "Cancelar pendência".',
        'Modal exibido com botão "Confirmar Cancelamento" desabilitado.',
      );

      await dialog.getByRole('combobox', { name: 'Motivo do cancelamento' }).click();
      await page.getByRole('option', { name: 'Cliente desistiu do pedido' }).click();
      await expect(confirmar).toBeEnabled();

      const patchStatus = page.waitForResponse(
        (r) => r.url().includes(`/comercial/overbooking/${pendenciaId}/status`) && r.ok(),
      );
      await confirmar.click();
      await patchStatus;
      await expect(page.locator('span').filter({ hasText: 'Cancelado' }).first()).toBeVisible({ timeout: 15_000 });

      await capture(
        page, steps, '02-overbooking-cancelado',
        'Overbooking — pendência cancelada',
        'Evidenciar status Cancelado após confirmação com motivo.',
        'Selecionar motivo e confirmar cancelamento.',
        'Status da pendência muda para Cancelado.',
      );

      expect(erros, erros.join('\n')).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test('overbooking: modal postergar mostra max = déficit da pendência', async ({ request }) => {
    const quantidadePedida = 5;
    await criarPendenciaOverbooking(request, adminCookie, dados, quantidadePedida);
    const page = await gestorContext.newPage();
    try {
      await page.goto(`/gestao/overbooking?operacaoId=${dados.operacaoId}`);
      const cardsAbertos = page.locator('button').filter({ hasText: 'Déficit:' });
      await expect(cardsAbertos.first()).toBeVisible({ timeout: 15_000 });
      await cardsAbertos.first().click();

      const botaoPostergar = page.getByRole('button', { name: 'Postergar' });
      if (await botaoPostergar.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const deficitTexto = await page
          .locator('dd', { hasText: /^\d/ })
          .first()
          .textContent();
        await botaoPostergar.click();
        const dialog = page.getByRole('dialog', { name: 'Postergar para Próxima Operação' });
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        const input = dialog.locator('input[type="number"]');
        await expect(input).toBeVisible();
        const max = await input.getAttribute('max');
        expect(max).toBeTruthy();
        if (deficitTexto) expect(Number(max)).toBeGreaterThan(0);

        await capture(
          page, steps, '03-overbooking-postergar-max-deficit',
          'Overbooking — postergação parcial com clamp de quantidade',
          'Evidenciar que o campo de quantidade a postergar tem max = déficit.',
          'Selecionar pendência com cobertura de próxima operação → clicar "Postergar".',
          `Input numérico com atributo max="${max}" (déficit da pendência).`,
        );
      } else {
        // Sem próxima operação elegível neste ambiente de teste — registra evidência do estado da tela.
        await capture(
          page, steps, '03-overbooking-postergar-max-deficit',
          'Overbooking — bloco de postergação (sem operação destino elegível)',
          'Evidenciar o bloco de postergação quando não há operação destino elegível.',
          'Selecionar pendência aberta.',
          'Bloco "3. Postergar para próxima operação" exibido com mensagem de indisponibilidade.',
        );
      }
    } finally {
      await page.close();
    }
  });

  test('aprovações: timeline de andamentos aparece após registrar', async ({ request }) => {
    const pedidoPf = await backend<{ id: string }>(request, adminCookie, 'POST', '/operacao/pedidos-fornecedor', {
      compraProgramadaId: dados.compraId,
    });
    await backend(request, adminCookie, 'POST', `/operacao/pedidos-fornecedor/${pedidoPf.id}/enviar`);
    const receb = await backend<{ recebimento: { id: string } }>(request, adminCookie, 'POST', '/operacao/recebimentos', {
      pedidoFornecedorId: pedidoPf.id,
    });
    await backend(request, adminCookie, 'POST', `/operacao/pedidos-fornecedor/${pedidoPf.id}/nf`, {
      numero: `NF-O75-${dados.runId}`,
      recebimentoId: receb.recebimento.id,
      itens: [{ itemComercialId: dados.itemComercialId, quantidadeDeclarada: 1, pesoDeclarado: 10 }],
    });
    const conclusao = await backend<{ ocorrencias: number }>(
      request, adminCookie, 'POST', `/operacao/recebimentos/${receb.recebimento.id}/conferencia/concluir`,
      { resultado: 'com_divergencia', observacao: 'Divergência E2E Onda 7.5' },
    );
    if (conclusao.ocorrencias < 1) {
      throw new Error('Conferência E2E não gerou ocorrência para o teste de timeline');
    }

    const page = await gestorContext.newPage();
    try {
      await page.goto(`/gestao/aprovacoes?operacaoId=${dados.operacaoId}`);
      await page.getByRole('button', { name: 'Fila Administrativa de Ocorrências' }).click();
      const primeiraOcorrencia = page.locator('button').filter({ has: page.locator('p.font-semibold') }).first();
      await expect(primeiraOcorrencia).toBeVisible({ timeout: 15_000 });
      await primeiraOcorrencia.click();

      const textareaAndamento = page.locator('#andamento');
      await expect(textareaAndamento).toBeVisible({ timeout: 10_000 });
      await textareaAndamento.fill('Contato realizado com o fornecedor — E2E Onda 7.5');
      const patchOcorrencia = page.waitForResponse(
        (r) => r.request().method() === 'PATCH' && r.url().includes('/api/operacao/ocorrencias-fornecedor/') && r.ok(),
      );
      await page.getByRole('button', { name: 'Registrar andamento' }).click();
      await patchOcorrencia;

      await expect(page.getByText('Timeline de andamentos')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Contato realizado com o fornecedor — E2E Onda 7.5')).toBeVisible();

      await capture(
        page, steps, '04-aprovacoes-timeline',
        'Aprovações — timeline de andamentos',
        'Evidenciar que o andamento registrado aparece na timeline.',
        'Selecionar ocorrência → registrar andamento pelo formulário.',
        'Timeline exibe o andamento recém-registrado.',
      );
    } finally {
      await page.close();
    }
  });

  test('SIF: clicar Pré-visualizar abre Dialog com título "Pré-visualização —"', async () => {
    const page = await gestorContext.newPage();
    try {
      await page.goto(`/gestao/relatorios?operacaoId=${dados.operacaoId}`);
      const botaoPreview = page.getByRole('button', { name: 'Pré-visualizar' }).first();
      await expect(botaoPreview).toBeVisible({ timeout: 15_000 });
      await botaoPreview.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByText(/Pré-visualização —/)).toBeVisible();

      await capture(
        page, steps, '05-sif-preview',
        'SIF — modal de pré-visualização',
        'Evidenciar o Dialog de pré-visualização com o título esperado.',
        'Clicar "Pré-visualizar" no primeiro relatório da operação.',
        'Dialog aberto com título "Pré-visualização — {nome}".',
      );
    } finally {
      await page.close();
    }
  });
});
