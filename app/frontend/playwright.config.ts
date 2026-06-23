import { defineConfig, devices } from '@playwright/test';

const frontendUrl = process.env.E2E_FRONTEND_URL ?? 'http://localhost:3100';

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
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
