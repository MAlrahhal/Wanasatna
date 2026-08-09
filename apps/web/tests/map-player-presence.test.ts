/**
 * Presence mapping: CONNECTED vs DISCONNECTED must surface in lobby roster.
 * Run: pnpm --filter @wanasatna/web exec node ../server/node_modules/tsx/dist/cli.mjs tests/map-player-presence.test.ts
 */
import assert from 'node:assert/strict';
import { toLobbyPlayer, toLobbyPlayers } from '../lib/room/map-player';
import type { RoomPlayerData } from '@wanasatna/shared';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

const connected: RoomPlayerData = {
  id: 'p1',
  name: 'محمد',
  status: 'CONNECTED',
  isSpectator: false,
  isHost: true,
};

const disconnected: RoomPlayerData = {
  id: 'p2',
  name: 'خالد',
  status: 'DISCONNECTED',
  isSpectator: false,
  isHost: false,
};

test('CONNECTED maps to isConnected true', () => {
  assert.equal(toLobbyPlayer(connected).isConnected, true);
});

test('DISCONNECTED maps to isConnected false (still in roster)', () => {
  const mapped = toLobbyPlayer(disconnected);
  assert.equal(mapped.isConnected, false);
  assert.equal(mapped.id, 'p2');
});

test('snapshot preserves mixed presence', () => {
  const players = toLobbyPlayers([connected, disconnected]);
  assert.deepEqual(
    players.map((player) => [player.id, player.isConnected]),
    [
      ['p1', true],
      ['p2', false],
    ],
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
