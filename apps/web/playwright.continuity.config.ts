import { defineConfig, devices } from '@playwright/test';

const SERVER_HEALTH = 'http://localhost:4001/api/health';
const WEB_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002';

/**
 * Production-build identity + Home→Lobby continuity gate.
 * Uses next build + next start (not next dev).
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch:
    /(?:room-v2-core|home-lobby-continuity|leave-fresh-entry)\.spec\.ts/,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: WEB_URL,
    locale: 'ar-SA',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command:
        'pnpm --filter @wanasatna/shared build && cross-env WANASATNA_TEST_MODE=1 PORT=4001 CLIENT_ORIGIN=http://localhost:3002 pnpm --filter @wanasatna/server exec tsx src/index.ts',
      url: SERVER_HEALTH,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command:
        'pnpm --filter @wanasatna/shared build && cross-env NEXT_PUBLIC_SERVER_URL=http://localhost:4001 NEXT_PUBLIC_ROOM_V2_DIAG=1 pnpm --filter @wanasatna/web build && cross-env NEXT_PUBLIC_SERVER_URL=http://localhost:4001 NEXT_PUBLIC_ROOM_V2_DIAG=1 PORT=3002 pnpm --filter @wanasatna/web start',
      url: WEB_URL,
      reuseExistingServer: true,
      timeout: 420_000,
    },
  ],
});
