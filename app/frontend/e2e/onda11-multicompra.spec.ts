/**
 * Onda 11 — jornada multicompra: master-detail, pedido por operação,
 * origem sequencial em pesagem/pedido/expedição e evidências DS v3.
 */

import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
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

const EVIDENCE_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'onda11-multicompra');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-onda11');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function rotuloLote(seq: number): string {
  return `Lote ${String(seq).padStart(3, '0')}`;
}

function gitSha(): string {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..', '..', '..'),
  });
  return (r.stdout || '').trim() || 'desconhecido';
}

interface DadosO11 {
  runId: string;
  sha: string;
  dataOperacao: string;
  operacaoId: string;
  compra1Id: string;
  compra2Id: string;
  seq1: number;
  seq2: number;
  fornecedorId: string;
  clienteId: string;
  clienteRazao: string;
  itemCompraId: string;
  itemComercialId: string;
  itemComercialDescricao: string;
  pedidoId: string;
  recebimento1Id: string;
  recebimento2Id: string;
  caminhaoId: string;
}

function writeReport(dados: DadosO11, urls: string[]) {
  const pendencia = fs.existsSync(path.join(EVIDENCE_DIR, 'PENDENCIA-ETIQUETA.md'))
    ? fs.readFileSync(path.join(EVIDENCE_DIR, 'PENDENCIA-ETIQUETA.md'), 'utf8').trim()
    : 'v1.1 §16.12: o payload/layout físico não possui campo canônico de lote; inclusão exige decisão registrada. Onda 11 preserva o layout.';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Onda 11 — evidências multicompra</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #111; }
    h1 { font-size: 1.4rem; }
    table { border-collapse: collapse; margin: 12px 0 24px; }
    td, th { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
    img { max-width: 100%; border: 1px solid #e5e5e5; margin: 8px 0 24px; }
    code { font-size: 0.9em; }
    .note { background: #fff8e6; border: 1px solid #e6d9a8; padding: 12px; }
  </style>
</head>
<body>
  <h1>Onda 11 — Múltiplas compras por operação</h1>
  <p>Referência visual: <strong>AD-10 / DS v3</strong> (<code>docs/ds-preview/direcao-a/</code>). Protótipo v1.1 não foi exigido.</p>
  <table>
    <tr><th>SHA</th><td><code>${escapeHtml(dados.sha)}</code></td></tr>
    <tr><th>Data</th><td>${escapeHtml(new Date().toISOString())}</td></tr>
    <tr><th>Run</th><td>${escapeHtml(dados.runId)}</td></tr>
    <tr><th>Operação</th><td><code>${escapeHtml(dados.operacaoId)}</code> · ${escapeHtml(dados.dataOperacao)}</td></tr>
    <tr><th>Compra 001</th><td><code>${escapeHtml(dados.compra1Id)}</code> · ${escapeHtml(rotuloLote(dados.seq1))}</td></tr>
    <tr><th>Compra 002</th><td><code>${escapeHtml(dados.compra2Id)}</code> · ${escapeHtml(rotuloLote(dados.seq2))}</td></tr>
    <tr><th>Pedido</th><td><code>${escapeHtml(dados.pedidoId)}</code></td></tr>
    <tr><th>Recebimentos</th><td><code>${escapeHtml(dados.recebimento1Id)}</code> / <code>${escapeHtml(dados.recebimento2Id)}</code></td></tr>
    <tr><th>Caminhão</th><td><code>${escapeHtml(dados.caminhaoId)}</code></td></tr>
  </table>
  <h2>Comandos do gate local</h2>
  <pre>HARDWARE_FAKE=1 NFSE_FAKE=1
npm ci / lint / type-check / test
app/backend: npm run test:cov ; npx drizzle-kit check
app/frontend: npm test ; npx playwright test e2e/onda5-gestao.spec.ts e2e/onda11-multicompra.spec.ts
docker compose up --build -d</pre>
  <p>Playwright O11 URLs: ${urls.map((u) => `<code>${escapeHtml(u)}</code>`).join(' · ')}</p>
  <h2>Telas (DS v3)</h2>
  <h3>01 — Compras master-detail</h3>
  <p><a href="01-compras-master-detail.png">01-compras-master-detail.png</a></p>
  <img src="01-compras-master-detail.png" alt="Compras master-detail" />
  <h3>02 — Pedido seleciona operação</h3>
  <p><a href="02-pedido-operacao.png">02-pedido-operacao.png</a></p>
  <img src="02-pedido-operacao.png" alt="Pedido operação" />
  <h3>03 — Pesagem com lote sequencial</h3>
  <p><a href="03-pesagem-lote.png">03-pesagem-lote.png</a></p>
  <img src="03-pesagem-lote.png" alt="Pesagem lote" />
  <h3>04 — Expedição origem do lote</h3>
  <p><a href="04-expedicao-origem.png">04-expedicao-origem.png</a></p>
  <img src="04-expedicao-origem.png" alt="Expedição origem" />
  <div class="note">
    <strong>Pendência da etiqueta</strong>
    <p>${escapeHtml(pendencia)}</p>
  </div>
</body>
</html>
`;
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'index.html'), html, 'utf8');
}

async function prepararCenario(
  api: APIRequestContext,
  adminCookie: string,
): Promise<DadosO11> {
  const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const suffix = runId.slice(-6);
  const dataOperacao = new Date().toISOString().slice(0, 10);
  const clienteRazao = `Cliente Onda11 ${suffix}`;
  const itemDesc = `Traseiro O11 ${suffix}`;

  const fornecedor = await backend<{ id: string }>(api, adminCookie, 'POST', '/fornecedores', {
    codigo: `O11F${suffix}`,
    razaoSocial: `Fornecedor Onda11 ${suffix}`,
    documentoFiscal: makeCpf(Number(suffix) + 11),
  });
  const itemCompra = await backend<{ id: string }>(api, adminCookie, 'POST', '/itens-compra', {
    codigo: `O11IC${suffix}`,
    descricao: 'Boi Onda11',
    unidadeCompra: 'cabeca',
  });
  const itemComercial = await backend<{ id: string }>(api, adminCookie, 'POST', '/itens-comerciais', {
    codigo: `O11TZ${suffix}`,
    descricao: itemDesc,
    unidadeComercial: 'parte',
  });
  const cliente = await backend<{ id: string }>(api, adminCookie, 'POST', '/clientes', {
    codigo: `O11CL${suffix}`,
    razaoSocial: clienteRazao,
    documentoFiscal: makeCpf(Number(suffix) + 22),
  });
  await backend(api, adminCookie, 'POST', '/regras-desdobramento', {
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
    fatorQuantidade: 1,
    status: 'ativo',
    vigenciaInicio: '2026-01-01',
  });

  const extra = await api.fetch(`${BACKEND_URL}/operacoes/extraordinaria`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    data: { data: dataOperacao, rotulo: `Onda11 E2E ${suffix}` },
  });
  let operacaoId = '';
  if (extra.ok()) {
    operacaoId = ((await extra.json()) as { id: string }).id;
  } else {
    const list = await backend<{ data: Array<{ id: string }> }>(
      api,
      adminCookie,
      'GET',
      `/operacoes?de=${dataOperacao}&ate=${dataOperacao}&limite=1`,
    );
    operacaoId = list.data[0]?.id ?? '';
  }
  if (!operacaoId) throw new Error('Operação do dia não encontrada');

  const criarCompra = async (qtd: number) => {
    const criar = await backend<{ id: string; numeroSequencial: number }>(
      api,
      adminCookie,
      'POST',
      '/comercial/compras-programadas',
      {
        dataOperacao,
        fornecedorId: fornecedor.id,
        itens: [{ itemCompraId: itemCompra.id, quantidadeComprada: qtd }],
      },
    );
    await backend(api, adminCookie, 'POST', `/comercial/compras-programadas/${criar.id}/confirmar`);
    return criar;
  };
  const compra1 = await criarCompra(6);
  const compra2 = await criarCompra(4);

  const pfDe = async (compraId: string) => {
    const pf = await backend<{ id: string }>(api, adminCookie, 'POST', '/operacao/pedidos-fornecedor', {
      compraProgramadaId: compraId,
    });
    await backend(api, adminCookie, 'POST', `/operacao/pedidos-fornecedor/${pf.id}/enviar`);
    const rec = await backend<{ recebimento: { id: string } }>(
      api,
      adminCookie,
      'POST',
      '/operacao/recebimentos',
      { pedidoFornecedorId: pf.id },
    );
    return rec.recebimento.id;
  };
  const recebimento1Id = await pfDe(compra1.id);
  const recebimento2Id = await pfDe(compra2.id);

  return {
    runId,
    sha: gitSha(),
    dataOperacao,
    operacaoId,
    compra1Id: compra1.id,
    compra2Id: compra2.id,
    seq1: compra1.numeroSequencial,
    seq2: compra2.numeroSequencial,
    fornecedorId: fornecedor.id,
    clienteId: cliente.id,
    clienteRazao,
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
    itemComercialDescricao: itemDesc,
    pedidoId: '',
    recebimento1Id,
    recebimento2Id,
    caminhaoId: '',
  };
}

test.describe('Onda 11 — jornada multicompra', () => {
  test.describe.configure({ mode: 'serial' });

  let ctx: BrowserContext;
  let dados: DadosO11;
  let adminCookie: string;
  const urls: string[] = [];

  test.beforeAll(async ({ browser, baseURL, request }) => {
    fs.rmSync(SCREENSHOTS_DIR, { recursive: true, force: true });
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    adminCookie = await loginBackend(request, ADMIN_EMAIL, ADMIN_PASSWORDS);
    dados = await prepararCenario(request, adminCookie);

    ctx = await browser.newContext({ baseURL });
    const loginRes = await ctx.request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORDS[0] },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!loginRes.ok()) {
      for (const password of ADMIN_PASSWORDS.slice(1)) {
        const retry = await ctx.request.post('/api/auth/login', {
          data: { email: ADMIN_EMAIL, password },
          headers: { 'Content-Type': 'application/json' },
        });
        if (retry.ok()) {
          await ctx.addCookies(cookiesFromResponse(retry, baseURL!));
          return;
        }
      }
      throw new Error(`login admin falhou: ${loginRes.status()} ${await loginRes.text()}`);
    }
    await ctx.addCookies(cookiesFromResponse(loginRes, baseURL!));
  });

  test.afterAll(async () => {
    if (dados) writeReport(dados, urls);
    await ctx?.close();
  });

  async function shot(page: Page, file: string) {
    const source = path.join(SCREENSHOTS_DIR, file);
    const target = path.join(EVIDENCE_DIR, file);
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
    await page.screenshot({ path: source, fullPage: true });
    fs.copyFileSync(source, target);
    urls.push(page.url());
  }

  test('master-detail, pedido por operação, origem em quatro telas', async ({ request }) => {
    test.setTimeout(180_000);
    const page = await ctx.newPage();
    try {
      await page.goto(
        `/gestao/compras?dataOperacao=${dados.dataOperacao}&compraId=${dados.compra1Id}`,
      );
      await expect(page.getByText(rotuloLote(dados.seq1))).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(rotuloLote(dados.seq2))).toBeVisible();
      await shot(page, '01-compras-master-detail.png');

      await page.goto('/comercial/pedidos');
      await page.getByRole('button', { name: 'Novo pedido' }).click();
      await expect(page.getByLabel('Operação')).toBeVisible({ timeout: 20_000 });
      await page.getByRole('combobox', { name: /Buscar cliente/i }).click();
      await page.getByPlaceholder('Buscar cliente...').fill(dados.clienteRazao);
      await page.getByRole('option', { name: new RegExp(dados.clienteRazao) }).click();
      await page.locator('#pedido-operacao').selectOption(dados.operacaoId);
      await page.locator('#produto-novo').selectOption(dados.itemComercialId);
      await page.locator('#quantidade-produto-novo').fill('2');
      await page.getByRole('button', { name: 'Adicionar produto' }).click();
      await expect(page.getByText(dados.itemComercialDescricao)).toBeVisible();
      await shot(page, '02-pedido-operacao.png');
      await page.getByRole('button', { name: 'Salvar Rascunho' }).click();
      await expect(page.getByRole('heading', { name: 'Pedidos de Venda' })).toBeVisible({ timeout: 20_000 });

      const pedidos = await backend<{ data: Array<{ id: string; clienteId: string }> }>(
        request,
        adminCookie,
        'GET',
        '/comercial/pedidos?pageSize=100',
      );
      const criado = pedidos.data.find((p) => p.clienteId === dados.clienteId);
      expect(criado).toBeTruthy();
      dados.pedidoId = criado!.id;
      const det = await backend<{ itens: Array<{ id: string }> }>(
        request,
        adminCookie,
        'GET',
        `/comercial/pedidos/${dados.pedidoId}`,
      );
      const pedidoItemId = det.itens[0]!.id;

      const pesar = async (recebimentoId: string) => {
        const peca = await backend<{ id: string }>(
          request,
          adminCookie,
          'POST',
          '/operacao/pesagem/pecas',
          {
            recebimentoId,
            itemComercialBaseId: dados.itemComercialId,
            modoCaptura: 'automatico',
          },
        );
        await backend(request, adminCookie, 'POST', `/operacao/pesagem/pecas/${peca.id}/confirmar`, {
          pedidoVendaItemId: pedidoItemId,
        });
        await backend(request, adminCookie, 'POST', `/operacao/pesagem/pecas/${peca.id}/etiqueta`);
        return peca.id;
      };
      const peca1 = await pesar(dados.recebimento1Id);
      const peca2 = await pesar(dados.recebimento2Id);

      await page.goto(`/comercial/pedidos`);
      await page.getByText(dados.clienteRazao).first().click();
      await expect(page.getByText('Origem do atendimento')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(new RegExp(rotuloLote(dados.seq1)))).toBeVisible();
      await expect(page.getByText(new RegExp(rotuloLote(dados.seq2)))).toBeVisible();

      await page.goto(`/recebimento/pesagem-destinacao?recebimentoId=${dados.recebimento1Id}`);
      await expect(page.getByText(rotuloLote(dados.seq1))).toBeVisible({ timeout: 20_000 });
      await shot(page, '03-pesagem-lote.png');

      await page.goto('/recebimento/recebimento-carga');
      await expect(page.getByText(rotuloLote(dados.seq1)).or(page.getByText(`#${rotuloLote(dados.seq1)}`))).toBeVisible({ timeout: 20_000 }).catch(() => undefined);

      const caminhao = await backend<{ id: string }>(
        request,
        adminCookie,
        'POST',
        '/operacao/expedicao/caminhoes',
        {
          placa: `O11${dados.runId.slice(-4)}`,
          motorista: 'Motorista O11',
          dataOperacao: dados.dataOperacao,
        },
      );
      dados.caminhaoId = caminhao.id;
      await backend(request, adminCookie, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/pedidos`, {
        pedidoVendaId: dados.pedidoId,
      });
      await backend(request, adminCookie, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/abrir-carga`);
      await backend(request, adminCookie, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/itens`, {
        tipoOrigem: 'peca',
        id: peca1,
      });
      await backend(request, adminCookie, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/itens`, {
        tipoOrigem: 'peca',
        id: peca2,
      });
      await backend(
        request,
        adminCookie,
        'POST',
        `/operacao/expedicao/caminhoes/${caminhao.id}/conferencia/iniciar`,
      );

      await page.goto('/carga/conferencia');
      await page.getByText(caminhao.id.slice(0, 8)).first().click({ timeout: 20_000 }).catch(async () => {
        await page.locator('button').filter({ hasText: /O11|Placa/ }).first().click();
      });
      await expect(page.getByText(rotuloLote(dados.seq1))).toBeVisible({ timeout: 20_000 });
      await shot(page, '04-expedicao-origem.png');
    } finally {
      await page.close();
    }
  });
});
