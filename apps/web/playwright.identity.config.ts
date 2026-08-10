import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(?:identity-forensics|production-identity-failure|room-identity-contract)\.spec\.ts/,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    locale: 'ar-SA',
    ...devices['Desktop Chrome'],
  },
});
