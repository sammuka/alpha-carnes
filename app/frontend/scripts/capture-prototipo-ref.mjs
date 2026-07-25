import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  '../../../docs/evidencias/onda2-shell/referencia-prototipo',
);
const BASE_URL = 'http://127.0.0.1:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(OUT_DIR, '01-login-prototipo.png'), fullPage: false });

await page.getByRole('button', { name: 'Acessar Sistema' }).click();
await page.waitForURL('**/gestao/dashboard', { timeout: 15000 });
await page.getByText('Painel Geral da Operação').first().waitFor({ timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT_DIR, '02-shell-prototipo.png'), fullPage: false });

await browser.close();
console.log('Screenshots saved to', OUT_DIR);
