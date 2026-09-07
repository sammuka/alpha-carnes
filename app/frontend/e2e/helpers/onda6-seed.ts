/**
 * Seed HTTP da Onda 6 — monta lote em `aguardando_conferencia_final`
 * (DoD 6.23), sem depender de E2E_ONDA6_SEED externo.
 *
 * Fluxo: compra → PF enviado → recebimento → registra itens sem divergência →
 * conclui pesagem/lote → cabeçalho NF (itens da NF ficam para a UI capturar).
 */
import type { APIRequestContext } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    out[trimmed.slice(0, i).trim()] = trimmed
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return out;
}

const ROOT_ENV = loadEnvFile(path.join(__dirname, '../../../../.env'));
const BACKEND_ENV = loadEnvFile(path.join(__dirname, '../../../../app/backend/.env'));

export const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:4001';

export const ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL ??
  BACKEND_ENV.SEED_ADMIN_EMAIL ??
  ROOT_ENV.SEED_ADMIN_EMAIL ??
  'admin@alphacarnes.local';

const ADMIN_PASSWORDS = [
  process.env.SEED_ADMIN_PASSWORD,
  BACKEND_ENV.SEED_ADMIN_PASSWORD,
  ROOT_ENV.SEED_ADMIN_PASSWORD,
  process.env.E2E_USER_PASSWORD,
  'Admin@123',
  'change-me-admin-password',
].filter((p): p is string => !!p);

function cookieHeaderFromResponse(res: { headers: () => Record<string, string> }): string {
  const raw = res.headers()['set-cookie'];
  if (!raw) return '';
  const parts = Array.isArray(raw) ? raw : [raw];
  return parts.map((c) => c.split(';')[0]).join('; ');
}

async function parseJson<T>(res: { json: () => Promise<unknown>; text: () => Promise<string> }): Promise<T> {
  return (await res.json().catch(async () => ({ raw: await res.text() }))) as T;
}

export async function loginBackend(
  api: APIRequestContext,
): Promise<{ cookieHeader: string; password: string; setCookies: string[] }> {
  const errors: string[] = [];
  for (const password of ADMIN_PASSWORDS) {
    const res = await api.post(`${BACKEND_URL}/auth/login`, {
      data: { email: ADMIN_EMAIL, password },
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok()) {
      const headers = res.headersArray();
      const setCookies = headers
        .filter((h) => h.name.toLowerCase() === 'set-cookie')
        .map((h) => h.value);
      return {
        cookieHeader: cookieHeaderFromResponse(res),
        password,
        setCookies,
      };
    }
    errors.push(`${res.status()} ${await res.text().catch(() => '')}`);
  }
  throw new Error(`Login admin falhou em ${BACKEND_URL}: ${errors.join(' | ')}`);
}

/** Injeta cookies do backend no browser (Chromium às vezes descarta access_token do BFF). */
export async function autenticarPagina(
  page: import('@playwright/test').Page,
  api: APIRequestContext,
  baseURL = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3100',
): Promise<{ password: string }> {
  const { password, setCookies } = await loginBackend(api);
  const cookies = setCookies.map((raw) => {
    const [nameValue] = raw.split(';');
    const eq = nameValue.indexOf('=');
    return {
      name: nameValue.slice(0, eq),
      value: nameValue.slice(eq + 1),
      url: baseURL,
    };
  });
  await page.context().addCookies(cookies);
  return { password };
}

async function api<T>(
  request: APIRequestContext,
  cookieHeader: string,
  method: 'GET' | 'POST' | 'PATCH',
  route: string,
  body?: unknown,
): Promise<T> {
  const res = await request.fetch(`${BACKEND_URL}${route}`, {
    method,
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    data: body,
  });
  const data = await parseJson<T | { message?: unknown }>(res);
  if (!res.ok()) {
    throw new Error(`${method} ${route} → ${res.status()}: ${JSON.stringify(data)}`);
  }
  return data as T;
}

function addDaysISO(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function makeCpf(seed: number): string {
  const baseNumber = 100_000_000 + (Math.abs(seed) % 899_999_999);
  const digits = String(baseNumber).padStart(9, '0').split('').map(Number);
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

type RecebimentoDetalhe = {
  id: string;
  status: string;
  itens: Array<{ produtoId: string; quantidadeEsperada: string | number }>;
};

export async function seedLoteParaConferencia(request: APIRequestContext): Promise<{
  recebimentoId: string;
  password: string;
}> {
  const { cookieHeader, password } = await loginBackend(request);
  const runId = Date.now().toString(36);

  const suffix = runId.slice(-6);
  const seedNum = Number(String(Date.now()).slice(-9));

  const fornecedor = await api<{ id: string }>(request, cookieHeader, 'POST', '/fornecedores', {
    codigo: `O6F${suffix}`,
    razaoSocial: `Fornecedor Onda6 ${suffix}`,
    documentoFiscal: makeCpf(seedNum + 1),
  });
  const itemCompra = await api<{ id: string }>(request, cookieHeader, 'POST', '/produtos', {
    codigo: `O6IC${suffix}`,
    nome: 'Boi Onda6',
    unidadePedido: 'unidade',
  });
  const itemComercial = await api<{ id: string }>(
    request,
    cookieHeader,
    'POST',
    '/produtos',
    {
      codigo: `O6TZ${suffix}`,
      nome: 'Traseiro Onda6',
      unidadePedido: 'kg',
    },
  );
  await api(request, cookieHeader, 'POST', '/regras-desdobramento', {
    produtoOrigemId: itemCompra.id,
    produtoDestinoId: itemComercial.id,
    fatorQuantidade: 2,
    status: 'ativo',
    vigenciaInicio: addDaysISO(-1),
  });

  let compraId = '';
  for (let offset = 1; offset < 40; offset += 1) {
    const dataOperacao = addDaysISO(offset);
    const create = await request.post(`${BACKEND_URL}/comercial/compras-programadas`, {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      data: {
        dataOperacao,
        fornecedorId: fornecedor.id,
        numeroInterno: `O6-${runId}-${offset}`,
        itens: [{ produtoId: itemCompra.id, quantidadeComprada: 5 }],
      },
    });
    const body = await parseJson<{ id?: string }>(create);
    if (create.status() === 409) continue;
    if (!create.ok() || !body.id) {
      throw new Error(`Criar compra: ${create.status()} ${JSON.stringify(body)}`);
    }
    await api(request, cookieHeader, 'POST', `/comercial/compras-programadas/${body.id}/confirmar`);
    compraId = body.id;
    break;
  }
  if (!compraId) throw new Error('Seed Onda 6: sem data livre para compra');

  const pf = await api<{ id: string }>(
    request,
    cookieHeader,
    'POST',
    '/operacao/pedidos-fornecedor',
    { compraProgramadaId: compraId },
  );
  await api(request, cookieHeader, 'POST', `/operacao/pedidos-fornecedor/${pf.id}/enviar`);

  const ini = await api<{ recebimento?: { id: string }; id?: string }>(
    request,
    cookieHeader,
    'POST',
    '/operacao/recebimentos',
    { pedidoFornecedorId: pf.id },
  );
  const recebimentoId = ini.recebimento?.id ?? ini.id;
  if (!recebimentoId) {
    throw new Error(`Seed Onda 6: iniciar recebimento sem id: ${JSON.stringify(ini)}`);
  }

  await api(request, cookieHeader, 'PATCH', `/operacao/recebimentos/${recebimentoId}/nfe`, {
    nfeNumero: `O6${runId.slice(-6)}`,
    nfeSerie: '1',
  });

  const detalhe = await api<RecebimentoDetalhe>(
    request,
    cookieHeader,
    'GET',
    `/operacao/recebimentos/${recebimentoId}`,
  );
  if (!detalhe.itens?.length) {
    throw new Error('Seed Onda 6: recebimento sem itens esperados após iniciar');
  }

  for (const item of detalhe.itens) {
    await api(request, cookieHeader, 'POST', `/operacao/recebimentos/${recebimentoId}/itens`, {
      produtoId: item.produtoId,
      quantidadeRecebida: Number(item.quantidadeEsperada),
    });
  }

  await api(request, cookieHeader, 'POST', `/operacao/recebimentos/${recebimentoId}/concluir`);

  return { recebimentoId, password };
}
