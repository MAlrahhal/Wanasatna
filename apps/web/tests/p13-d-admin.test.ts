/**
 * P13-D — Admin Room capacity 20 UI contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_ROOM_PLAYER_CAP, MAX_ROOM_PLAYERS } from '@wanasatna/shared';
import { ADMIN_COPY } from '../lib/admin/copy';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('25-26 lobby count uses Room playerCap: /8 default and /20 when set', () => {
  assert.equal(MAX_ROOM_PLAYERS, 8);
  assert.equal(ADMIN_ROOM_PLAYER_CAP, 20);
  const panel = read('components/lobby/players-panel.tsx');
  const lobby = read('components/lobby/lobby-screen.tsx');
  assert.match(panel, /playerCap = MAX_ROOM_PLAYERS/);
  assert.match(panel, /players\.length\} \/ \{playerCap\}/);
  assert.doesNotMatch(panel, /players\.length\} \/ \{MAX_ROOM_PLAYERS\}/);
  assert.match(lobby, /playerCap=\{room\?\.playerCap\}/);
  assert.doesNotMatch(lobby, /غرفة إدارة|Admin Room|8 \/ 20/);
});

test('27-28 20-player Lobby scrolls on desktop and mobile', () => {
  const panel = read('components/lobby/players-panel.tsx');
  assert.match(panel, /overflow-y-auto/);
  assert.match(panel, /max-h-\[min\(58vh,600px\)\]/);
  assert.match(panel, /xl:max-h-\[min\(70vh,640px\)\]/);
  assert.doesNotMatch(panel, /xl:overflow-y-auto/);
});

test('create flow has no Admin Room badge or 8/20 selector', () => {
  const files = [
    'components/public/room-action-cards.tsx',
    'components/home/home-room-actions.tsx',
    'lib/public/use-room-actions.ts',
    'lib/room-v2/manager.ts',
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /playerCap|Admin Room|غرفة إدارة|ADMIN_ROOM_PLAYER_CAP/);
  }
  const manager = read('lib/room-v2/manager.ts');
  assert.match(manager, /CREATE_ROOM_EVENT,\s*\{\s*playerName\s*\}/);
});

test('admin rooms show read-only capacity; no editor', () => {
  assert.equal(ADMIN_COPY.capacity, 'السعة');
  const list = read('components/admin/admin-rooms-client.tsx');
  const detail = read('components/admin/admin-room-detail-client.tsx');
  const api = read('lib/admin/api.ts');
  assert.match(list, /room\.playerCount\} \/ \{room\.playerCap\}/);
  assert.match(detail, /ADMIN_COPY\.capacity/);
  assert.match(detail, /room\.playerCount\} \/ \{room\.playerCap\}/);
  assert.doesNotMatch(detail, /changeCapacity|setPlayerCap|playerCap:/);
  assert.doesNotMatch(list, /changeCapacity|setPlayerCap/);
  assert.match(api, /playerCap: record\.playerCap/);
  const pickRoom = api.slice(
    api.indexOf('function pickSafeRoom'),
    api.indexOf('export type AdminRoomsResult'),
  );
  assert.doesNotMatch(pickRoom, /role: record\.role|userId: record/);
});

test('Room snapshot type exposes playerCap, not Admin role', () => {
  const room = read('../../packages/shared/src/room/room.ts');
  const player = read('../../packages/shared/src/room/player.ts');
  const utils = read('../server/src/modules/room/room.utils.ts');
  assert.match(room, /playerCap: number/);
  assert.doesNotMatch(room, /role:/);
  assert.doesNotMatch(player, /role:|userId:/);
  assert.match(utils, /playerCap: room\.playerCap/);
  assert.doesNotMatch(utils, /role:|userId:/);
});

test('Guessing Challenge client max stays 4; other games are not hardcoded to 8', () => {
  assert.match(read('plugins/guessing-challenge/index.tsx'), /maxPlayers:\s*4/);
  assert.match(read('plugins/bara-al-salafa/index.tsx'), /maxPlayers:\s*20/);
  assert.doesNotMatch(read('plugins/draw-guess/index.tsx'), /maxPlayers:\s*8/);
  assert.doesNotMatch(read('plugins/imposter-draw/index.tsx'), /maxPlayers:\s*8/);
  assert.doesNotMatch(read('plugins/timing-challenge/index.tsx'), /maxPlayers:\s*8/);
  assert.doesNotMatch(read('plugins/fast-answer/index.tsx'), /maxPlayers:\s*8/);
  assert.doesNotMatch(read('plugins/who-wrote-it/index.tsx'), /maxPlayers:\s*8/);
  assert.doesNotMatch(read('plugins/judge/index.tsx'), /maxPlayers:\s*8/);
});

test('no custom timers, game settings, or Premium in this slice', () => {
  const detail = read('components/admin/admin-room-detail-client.tsx');
  assert.doesNotMatch(detail, /gameTimer|countdownSeconds|enableGame|premium|20-player/i);
  assert.doesNotMatch(read('lib/admin/copy.ts'), /premium|20-player/i);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
