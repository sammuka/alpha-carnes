/**
 * Captura referências do protótipo (Onda 9 — Carga: Planejamento, Conferência,
 * Enviar para Faturamento).
 * Pré-requisito: Vite do protótipo em http://127.0.0.1:5173
 *   cd F:/Projetos/alpha-carnes-prototipo && npm run dev -- --host 127.0.0.1 --port 5173
 */
import { chromium } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  '../../../docs/evidencias/onda9-carga/referencia-prototipo',
);
const BASE_URL = process.env.PROTOTIPO_URL ?? 'http://127.0.0.1:5173';

fs.mkdirSync(OUT_DIR, { recursive: true });

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

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
    path: '/carga/planejamento',
    file: 'proto-planejamento.png',
    prepare: async (p) => {
      await p.getByText('Pedidos do Dia (Sem Caminhão)').waitFor({ timeout: 15_000 });
      await p.getByText('Caminhões Montados').waitFor({ timeout: 15_000 });
    },
  },
  {
    path: '/carga/conferencia',
    file: 'proto-conferencia.png',
    prepare: async (p) => {
      await p.getByText('Conferência de Carga').waitFor({ timeout: 15_000 });
      await p.getByPlaceholder(/Bipar etiqueta/i).waitFor({ timeout: 15_000 });
    },
  },
  {
    path: '/carga/enviar-faturamento',
    file: 'proto-enviar-faturamento.png',
    prepare: async (p) => {
      await p.getByText('Histórico de Envios').waitFor({ timeout: 15_000 });
    },
  },
];

for (const r of rotas) {
  await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'networkidle' });
  await r.prepare(page);
  await page.waitForTimeout(400);
  const outPath = path.join(OUT_DIR, r.file);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log('ok', r.file, sha256File(outPath));
}

await browser.close();
console.log('Screenshots salvos em', OUT_DIR);
