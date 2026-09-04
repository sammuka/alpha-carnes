/**
 * Captura screenshots da app (Onda 9 — Carga: Planejamento, Conferência,
 * Enviar para Faturamento).
 * Pré-requisito: frontend em E2E_FRONTEND_URL (padrão :3100) e backend
 * autenticável em BACKEND_INTERNAL_URL (padrão :4001), HARDWARE_FAKE=1.
 *
 * Login via API + injeção de cookies (padrão Onda 6/7). Semeia 1 caminhão com
 * 1 peça carregada via HTTP (mesma sequência de app/frontend/e2e/helpers/onda9-seed.ts).
 * Falha se qualquer tela não renderizar o rótulo-chave esperado, ou se os 3
 * PNGs tiverem hash igual entre si.
 */
import { chromium } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../../docs/evidencias/onda9-carga');
const BASE_URL = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3100';
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4001';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const PASSWORDS = [
  process.env.SEED_ADMIN_PASSWORD,
  process.env.E2E_USER_PASSWORD,
  'change-me-admin-password',
  'Admin@AlphaCarnes2026!',
  'Admin@CiTest123456',
  'Admin@123',
].filter(Boolean);

fs.mkdirSync(OUT_DIR, { recursive: true });

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function parseSetCookies(headerList) {
  const cookies = [];
  for (const raw of headerList) {
    const [pair, ...attrs] = raw.split(';').map((s) => s.trim());
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    cookies.push({
      name,
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: attrs.some((a) => /^HttpOnly$/i.test(a)),
      secure: attrs.some((a) => /^Secure$/i.test(a)),
      sameSite: 'Lax',
    });
  }
  return cookies;
}

async function loginBackend() {
  const errors = [];
  for (const password of PASSWORDS) {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password }),
    });
    if (!res.ok) {
      errors.push(`${res.status}`);
      continue;
    }
    const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    if (raw.length === 0) {
      const single = res.headers.get('set-cookie');
      if (single) raw.push(single);
    }
    const cookieHeader = raw.map((c) => c.split(';')[0]).join('; ');
    const cookies = parseSetCookies(raw);
    if (!cookies.some((c) => c.name === 'access_token')) {
      errors.push('sem access_token');
      continue;
    }
    return { cookies, cookieHeader };
  }
  throw new Error(`Login backend falhou: ${errors.join(' | ')}`);
}

async function api(cookieHeader, method, route, body) {
  const res = await fetch(`${BACKEND_URL}${route}`, {
    method,
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function addDaysISO(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function makeCpf(seed) {
  const baseNumber = 100_000_000 + (Math.abs(seed) % 899_999_999);
  const digits = String(baseNumber).padStart(9, '0').split('').map(Number);
  const digit = (count) => {
    let sum = 0;
    for (let i = 0; i < count; i += 1) sum += (digits[i] ?? 0) * (count + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  digits.push(digit(9));
  digits.push(digit(10));
  return digits.join('');
}

/** Sequência idêntica a `seedCargaPronta` (e2e/helpers/onda9-seed.ts). */
async function seedCargaPronta(cookieHeader) {
  const runId = Date.now().toString(36);
  const suffix = runId.slice(-6);
  const seedNum = Number(String(Date.now()).slice(-9));

  const fornecedor = await api(cookieHeader, 'POST', '/fornecedores', {
    codigo: `O9F${suffix}`, razaoSocial: `Fornecedor Onda9 ${suffix}`, documentoFiscal: makeCpf(seedNum + 1),
  });
  const itemCompra = await api(cookieHeader, 'POST', '/itens-compra', {
    codigo: `O9IC${suffix}`, descricao: 'Boi Onda9', unidadeCompra: 'unidade',
  });
  const itemComercial = await api(cookieHeader, 'POST', '/itens-comerciais', {
    codigo: `O9TZ${suffix}`, descricao: 'Traseiro Onda9', unidadeComercial: 'kg',
  });
  await api(cookieHeader, 'POST', '/regras-desdobramento', {
    itemCompraId: itemCompra.id, itemComercialId: itemComercial.id, fatorQuantidade: 2,
    status: 'ativo', vigenciaInicio: addDaysISO(-1),
  });

  let compraId = '';
  let dataOperacao = '';
  for (let offset = 0; offset < 60; offset += 1) {
    const candidata = addDaysISO(offset);
    const res = await fetch(`${BACKEND_URL}/comercial/compras-programadas`, {
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataOperacao: candidata, fornecedorId: fornecedor.id,
        numeroInterno: `O9-${runId}-${offset}`,
        itens: [{ itemCompraId: itemCompra.id, quantidadeComprada: 5 }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) continue;
    if (!res.ok || !body.id) throw new Error(`Criar compra Onda9: ${res.status} ${JSON.stringify(body)}`);
    await api(cookieHeader, 'POST', `/comercial/compras-programadas/${body.id}/confirmar`);
    compraId = body.id;
    dataOperacao = candidata;
    break;
  }
  if (!compraId) throw new Error('Seed Onda9: sem data livre para compra');

  const pf = await api(cookieHeader, 'POST', '/operacao/pedidos-fornecedor', { compraProgramadaId: compraId });
  await api(cookieHeader, 'POST', `/operacao/pedidos-fornecedor/${pf.id}/enviar`);
  const ini = await api(cookieHeader, 'POST', '/operacao/recebimentos', { pedidoFornecedorId: pf.id });
  const recebimentoId = ini.recebimento?.id ?? ini.id;
  await api(cookieHeader, 'PATCH', `/operacao/recebimentos/${recebimentoId}/nfe`, { nfeNumero: `O9${suffix}`, nfeSerie: '1' });
  const detalhe = await api(cookieHeader, 'GET', `/operacao/recebimentos/${recebimentoId}`);
  for (const item of detalhe.itens) {
    await api(cookieHeader, 'POST', `/operacao/recebimentos/${recebimentoId}/itens`, {
      itemComercialId: item.itemComercialId, quantidadeRecebida: Number(item.quantidadeEsperada),
    });
  }
  await api(cookieHeader, 'POST', `/operacao/recebimentos/${recebimentoId}/concluir`);

  const cliente = await api(cookieHeader, 'POST', '/clientes', {
    codigo: `O9CLI${suffix}`, razaoSocial: `Cliente Onda9 ${suffix}`, documentoFiscal: makeCpf(seedNum + 2),
  });
  const pedido = await api(cookieHeader, 'POST', '/comercial/pedidos', {
    compraProgramadaId: compraId, clienteId: cliente.id, dataOperacao,
    rotaPrevista: 'Rota Onda9', prioridade: 3,
    itens: [{ itemComercialId: itemComercial.id, quantidadePedida: 1 }],
  });
  const pedidoDetalhe = await api(cookieHeader, 'GET', `/comercial/pedidos/${pedido.id}`);
  const pedidoItemId = pedidoDetalhe.itens[0]?.id;

  const peca = await api(cookieHeader, 'POST', '/operacao/pesagem/pecas', {
    recebimentoId, itemComercialBaseId: itemComercial.id, modoCaptura: 'automatico',
  });
  await api(cookieHeader, 'POST', `/operacao/pesagem/pecas/${peca.id}/confirmar`, { pedidoVendaItemId: pedidoItemId });
  await api(cookieHeader, 'POST', `/operacao/pesagem/pecas/${peca.id}/etiqueta`, {});

  const motoristaCadastro = await api(cookieHeader, 'POST', '/frota/motoristas', {
    nome: 'Motorista Onda9',
    documento: `O9M${suffix}`,
  });
  const caminhao = await api(cookieHeader, 'POST', '/operacao/expedicao/caminhoes', {
    placa: `O9-${suffix}`.toUpperCase(), motoristaId: motoristaCadastro.id, dataOperacao,
  });
  await api(cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/pedidos`, { pedidoVendaId: pedido.id });
  await api(cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/abrir-carga`, {});
  await api(cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/itens`, { tipoOrigem: 'peca', id: peca.id });

  return { caminhaoId: caminhao.id, placa: caminhao.placa, etiqueta: `QR-${peca.id}` };
}

const { cookies, cookieHeader } = await loginBackend();
const cenario = await seedCargaPronta(cookieHeader);
console.log('Seed Onda9:', cenario);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addCookies(cookies);
const page = await context.newPage();

await page.goto(`${BASE_URL}/carga/planejamento`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(800);
if (page.url().includes('/login')) {
  await browser.close();
  throw new Error('Redirect para /login — confira JWT_ACCESS_SECRET (frontend deve usar o mesmo do backend)');
}

// ── Planejamento ────────────────────────────────────────────────────────────
await page.getByRole('heading', { name: 'Planejamento de Expedição' }).waitFor({ timeout: 15_000 });
await page.getByText('Pedidos do Dia (Sem Caminhão)').waitFor({ timeout: 15_000 });
await page.getByText(cenario.placa).waitFor({ timeout: 15_000 });
await page.waitForTimeout(400);
const planPath = path.join(OUT_DIR, 'app-planejamento.png');
await page.screenshot({ path: planPath, fullPage: false });
console.log('ok app-planejamento.png', sha256File(planPath));

// Enviar para conferência (transição real, exercitada na captura seguinte).
await page.getByText('Enviar para conferência').click();
await page.getByText('Em Conferência').waitFor({ timeout: 15_000 });

// ── Conferência ─────────────────────────────────────────────────────────────
await page.goto(`${BASE_URL}/carga/conferencia`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.getByText('Conferência de Carga').waitFor({ timeout: 15_000 });
await page.getByText(`Carga #${cenario.caminhaoId.slice(0, 8)}`).first().waitFor({ timeout: 15_000 });
await page.getByText(`Carga #${cenario.caminhaoId.slice(0, 8)}`).first().click();
await page.getByText(`Placa: ${cenario.placa}`).waitFor({ timeout: 15_000 });
await page.waitForTimeout(400);
const confPath = path.join(OUT_DIR, 'app-conferencia.png');
await page.screenshot({ path: confPath, fullPage: false });
console.log('ok app-conferencia.png', sha256File(confPath));

// Bipagem manual assistida (etiqueta digitada) + finalizar → fecha a carga.
page.once('dialog', (dialog) => dialog.accept('Leitura manual — leitor indisponível'));
await page.getByPlaceholder(/Bipar etiqueta/i).fill(cenario.etiqueta);
await page.getByRole('button', { name: 'Bipar' }).click();
await page.getByText(/conferida\./i).waitFor({ timeout: 15_000 });
const finalizar = page.getByRole('button', { name: 'Finalizar Conferência' });
await finalizar.waitFor({ state: 'visible', timeout: 10_000 });
await finalizar.click();
await page.getByText('Carga conferida.').waitFor({ timeout: 15_000 });

// ── Enviar para Faturamento ─────────────────────────────────────────────────
await page.goto(`${BASE_URL}/carga/enviar-faturamento`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.getByRole('heading', { name: 'Enviar para Faturamento' }).waitFor({ timeout: 15_000 });
await page.getByText(`Carga #${cenario.caminhaoId.slice(0, 8)}`).first().waitFor({ timeout: 15_000 });
await page.getByText(`Carga #${cenario.caminhaoId.slice(0, 8)}`).first().click();
await page.getByText('Histórico de Envios').waitFor({ timeout: 15_000 });
await page.waitForTimeout(400);
const envPath = path.join(OUT_DIR, 'app-enviar-faturamento.png');
await page.screenshot({ path: envPath, fullPage: false });
console.log('ok app-enviar-faturamento.png', sha256File(envPath));

const shas = [planPath, confPath, envPath].map(sha256File);
if (new Set(shas).size !== shas.length) {
  await browser.close();
  throw new Error(`Screenshots com hash duplicado entre telas: ${JSON.stringify(shas)}`);
}
console.log('sha256 distintos entre as 3 telas:', shas);

await browser.close();
console.log('Screenshots salvos em', OUT_DIR);
