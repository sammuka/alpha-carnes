/**
 * Captura referências do protótipo (Onda 7 — Desossa).
 * Pré-requisito: Vite do protótipo em http://127.0.0.1:5173
 *   cd F:/Projetos/alpha-carnes-prototipo && npm run dev -- --host 127.0.0.1 --port 5173
 *
 * Falha se Modo TV não ativar ou se proto-dashboard.png ≡ proto-modo-tv.png.
 */
import { chromium } from '@playwright/test';
import crypto from 'crypto';
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

async function ativarModoTv(p) {
  const btn = p.getByRole('button', { name: /Modo TV|TV/i });
  await btn.waitFor({ state: 'visible', timeout: 15_000 });
  await btn.click();
  await p.getByText(/DESOSSA\s*[—-]\s*PAINEL OPERACIONAL|PAINEL OPERACIONAL/i).first().waitFor({
    timeout: 10_000,
  });
  await p.getByText(/CARGA\s*\/\s*HORÁRIO|Sair/i).first().waitFor({ timeout: 10_000 });
  await p.waitForTimeout(600);
}

await login();

const rotas = [
  {
    path: '/desossa/dashboard',
    file: 'proto-dashboard.png',
    prepare: async (p) => {
      await p.getByText(/TZs na desossa|DESOSSA/i).first().waitFor({ timeout: 15_000 });
      await p.getByRole('button', { name: /Modo TV|TV/i }).waitFor({
        state: 'visible',
        timeout: 15_000,
      });
    },
  },
  {
    path: '/desossa/dashboard',
    file: 'proto-modo-tv.png',
    prepare: async (p) => {
      await p.getByText(/TZs na desossa|DESOSSA/i).first().waitFor({ timeout: 15_000 });
      await ativarModoTv(p);
    },
  },
  {
    path: '/desossa/pesagem-destinacao',
    file: 'proto-pesagem.png',
    prepare: async (p) => {
      await p.getByText(/Pesagem|Destina/i).first().waitFor({ timeout: 15_000 });
      await p.getByText(/Selecione ou leia a etiqueta/i).waitFor({ timeout: 15_000 });
    },
  },
  {
    path: '/desossa/etiquetas',
    file: 'proto-etiquetas.png',
    prepare: async (p) => {
      await p.getByText(/Etiqueta/i).first().waitFor({ timeout: 15_000 });
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

const dashPath = path.join(OUT_DIR, 'proto-dashboard.png');
const tvPath = path.join(OUT_DIR, 'proto-modo-tv.png');
const dashSha = sha256File(dashPath);
const tvSha = sha256File(tvPath);
if (dashSha === tvSha) {
  await browser.close();
  throw new Error(
    `DoD 7.22: proto-dashboard.png e proto-modo-tv.png são idênticos (sha256=${dashSha}). Modo TV não capturado.`,
  );
}
console.log('sha256 proto-dashboard ≠ proto-modo-tv');
console.log('  dashboard:', dashSha);
console.log('  modo-tv:  ', tvSha);

await browser.close();
console.log('Screenshots salvos em', OUT_DIR);
