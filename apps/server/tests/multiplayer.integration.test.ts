/**
 * Multiplayer Socket.IO integration suite for Bara AlSalafa.
 * Requires server on localhost:4000 with WANASATNA_TEST_MODE=1.
 *
 * Run: pnpm --filter @wanasatna/server test:multiplayer
 */
import { assertStartBlocked, runFullMatchFlow } from './helpers/match-driver.js';
import { waitForServer } from './helpers/socket-utils.js';

const PLAYER_COUNTS = [3, 5, 8] as const;

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

async function main(): Promise<void> {
  console.log('[multiplayer] waiting for test server...');
  await waitForServer();

  for (const count of PLAYER_COUNTS) {
    await runTest(`full match ${count} players`, async () => {
      const result = await runFullMatchFlow(count);
      if (Object.keys(result.finalTotals).length !== count) {
        throw new Error(`expected ${count} scored players`);
      }
    });
  }

  await runTest('start blocked with 1 player', () => assertStartBlocked(1));
  await runTest('start blocked with 2 players', () => assertStartBlocked(2));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('multiplayer suite crashed:', error);
  process.exit(1);
});
