import { defineConfig, devices } from '@playwright/test';

// Playwright's Chromium service-worker network instrumentation applies the emulated offline state
// to the worker itself. Opt out so the browser can exercise its native Cache Storage behavior.
process.env.PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK ??= '1';

const wranglerRunId = process.pid;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run build && npx wrangler pages dev dist --ip 127.0.0.1 --port 4173 --compatibility-date 2026-08-18 --persist-to /tmp/family-table-wrangler-state-${wranglerRunId}`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: `/tmp/family-table-wrangler-${wranglerRunId}.log`,
    },
  },
});
