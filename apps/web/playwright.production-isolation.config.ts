import { defineConfig, devices } from '@playwright/test';

if (process.env.WANASATNA_PRODUCTION_WRITE_AUDIT_CONFIRM !== 'WRITE_TO_PRODUCTION') {
  throw new Error(
    'Production write audit blocked. Explicit approval is required before this config can run.',
  );
}

const productionWebUrl = process.env.WANASATNA_PROD_WEB_URL?.trim();
if (!productionWebUrl) {
  throw new Error('WANASATNA_PROD_WEB_URL must be set explicitly for a production write audit.');
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'production-isolation.audit.spec.ts',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: productionWebUrl,
    locale: 'ar-SA',
    ...devices['Desktop Chrome'],
  },
});
