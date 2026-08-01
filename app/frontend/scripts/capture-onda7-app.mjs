/**
 * Captura screenshots da app (Onda 7 — Desossa).
 * Pré-requisito: frontend http://localhost:3100 e backend autenticável.
 *
 * Login via API + injeção de cookies (padrão Onda 6).
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../../docs/evidencias/onda7-desossa');
const BASE_URL = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3100';
const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:4001';
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

function parseSetCookies(headerList) {
  const cookies = [];
  for (const raw of headerList) {
    const [pair, ...attrs] = raw.split(';').map((s) => s.trim());
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const cookie = {
      name,
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: attrs.some((a) => /^HttpOnly$/i.test(a)),
      secure: attrs.some((a) => /^Secure$/i.test(a)),
      sameSite: 'Lax',
    };
    const maxAge = attrs.find((a) => /^Max-Age=/i.test(a));
    if (maxAge) {
      cookie.expires = Math.floor(Date.now() / 1000) + Number(maxAge.split('=')[1]);
    }
    cookies.push(cookie);
  }
  return cookies;
}

async function loginCookies() {
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
    const raw =
      typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    if (raw.length === 0) {
      const single = res.headers.get('set-cookie');
      if (single) raw.push(single);
    }
    const cookies = parseSetCookies(raw);
    if (!cookies.some((c) => c.name === 'access_token')) {
      errors.push('sem access_token');
      continue;
    }
    return cookies;
  }
  throw new Error(`Login backend falhou: ${errors.join(' | ')}`);
}

const cookies = await loginCookies();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addCookies(cookies);
const page = await context.newPage();

await page.goto(`${BASE_URL}/desossa/dashboard`, { waitUntil: 'networkidle' });
if (page.url().includes('/login')) {
  await browser.close();
  throw new Error(
    'Redirect para /login após injetar cookies — confira JWT_ACCESS_SECRET no frontend',
  );
}

const rotas = [
  {
    path: '/desossa/dashboard',
    file: 'app-dashboard.png',
    wait: /TZs na desossa|Dashboard/i,
  },
  {
    path: '/desossa/dashboard',
    file: 'app-modo-tv.png',
    wait: /TZs na desossa|Dashboard/i,
    after: async (p) => {
      const btn = p.getByRole('button', { name: /Modo TV/i });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await p.getByText(/CARGA|HORÁRIO|Modo TV/i).first().waitFor({ timeout: 10_000 });
        await p.waitForTimeout(400);
      }
    },
  },
  {
    path: '/desossa/pesagem-destinacao',
    file: 'app-pesagem.png',
    wait: /Pesagem e Destinação/i,
  },
  {
    path: '/desossa/etiquetas',
    file: 'app-etiquetas.png',
    wait: /Etiquetas/i,
  },
];

for (const r of rotas) {
  await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'networkidle' });
  await page.getByText(r.wait).first().waitFor({ timeout: 15_000 });
  if (r.after) await r.after(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT_DIR, r.file), fullPage: false });
  console.log('ok', r.file);
}

await browser.close();
console.log('Screenshots salvos em', OUT_DIR);
