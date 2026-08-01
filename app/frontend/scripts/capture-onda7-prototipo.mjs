/**
 * Captura referências do protótipo (Onda 7 — Desossa).
 * Pré-requisito: Vite do protótipo em http://127.0.0.1:5173
 *   cd F:/Projetos/alpha-carnes-prototipo && npm run dev -- --host 127.0.0.1 --port 5173
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  '../../../docs/evidencias/onda7-desossa/referencia-prototipo',
);
const BASE_URL = process.env.PROTOTIPO_URL ?? 'http://127.0.0.1:5173';

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function login() {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  const acessar = page.getByRole('button', { name: /Acessar Sistema/i });
  if (await acessar.isVisible().catch(() => false)) {
    await acessar.click();
    await page.waitForTimeout(800);
  }
}

await login();

const rotas = [
  {
    path: '/desossa/dashboard',
    file: 'proto-dashboard.png',
    wait: /Desossa|Dashboard|TZs/i,
  },
  {
    path: '/desossa/dashboard',
    file: 'proto-modo-tv.png',
    wait: /Desossa|Dashboard|TZs/i,
    after: async (p) => {
      const btn = p.getByRole('button', { name: /Modo TV|TV/i });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await p.waitForTimeout(600);
      }
    },
  },
  {
    path: '/desossa/pesagem-destinacao',
    file: 'proto-pesagem.png',
    wait: /Pesagem|Destina/i,
  },
  {
    path: '/desossa/etiquetas',
    file: 'proto-etiquetas.png',
    wait: /Etiqueta/i,
  },
];

for (const r of rotas) {
  await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'networkidle' });
  await page.getByText(r.wait).first().waitFor({ timeout: 15_000 });
  if (r.after) await r.after(page);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT_DIR, r.file),
    fullPage: false,
  });
  console.log('ok', r.file);
}

await browser.close();
console.log('Screenshots salvos em', OUT_DIR);
