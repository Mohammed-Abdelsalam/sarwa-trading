import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // The dev server compiles each route on its first visit, which can outlast the default timeouts.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  // Both servers start from the repo root; locally an already running `pnpm dev` is reused.
  webServer: [
    {
      command: 'pnpm --filter @sarwa/server dev',
      cwd: '../..',
      url: 'http://localhost:4000/api/v1/health',
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
    {
      command: 'pnpm --filter @sarwa/web dev',
      cwd: '../..',
      url: 'http://localhost:3000',
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
