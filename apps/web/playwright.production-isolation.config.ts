import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'production-isolation.audit.spec.ts',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.WANASATNA_PROD_WEB_URL ?? 'https://wanasatna.com',
    locale: 'ar-SA',
    ...devices['Desktop Chrome'],
  },
});
