import { defineConfig, devices } from '@playwright/test';

/** Lightweight config for Real3D harness — expects `pnpm --filter @wanasatna/web dev` on :3000 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/gc-real3d-harness.spec.ts',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    locale: 'ar-SA',
    ...devices['Desktop Chrome'],
  },
});
