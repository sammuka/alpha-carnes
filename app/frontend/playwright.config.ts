import { defineConfig, devices } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Carrega chaves do .env da raiz do worktree (JWT do middleware, seed, BFF). */
function loadRootEnv(): void {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadRootEnv();

const frontendUrl = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3100';
const backendUrl = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4001';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  timeout: 600_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: frontendUrl,
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: frontendUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      BACKEND_INTERNAL_URL: backendUrl,
      NEXT_PUBLIC_API_URL: backendUrl,
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? '',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '',
    },
  },
});
