import { defineConfig, devices } from '@playwright/test';

// Playwright's Chromium service-worker network instrumentation applies the emulated offline state
// to the worker itself. Opt out so the browser can exercise its native Cache Storage behavior.
process.env.PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK ??= '1';

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
    command: 'npm run build && npm run preview:pages',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: '/tmp/family-table-wrangler.log',
    },
  },
});
