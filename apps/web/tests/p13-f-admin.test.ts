/**
 * P13-F — game availability UI contracts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('17 public UI marks disabled game unavailable', () => {
  const cards = read('components/public/game-cards.tsx');
  const badge = read('components/public/status-badge.tsx');
  const grid = read('components/lobby/game-grid.tsx');
  assert.match(cards, /غير متاحة حالياً/);
  assert.match(badge, /unavailable/);
  assert.match(badge, /غير متاحة حالياً/);
  assert.match(grid, /unavailable/);
  assert.doesNotMatch(cards, /Admin|الإدارة/);
  assert.doesNotMatch(grid, /Admin|الإدارة/);
});

test('18 disabled card cannot be selected', () => {
  const grid = read('components/lobby/game-grid.tsx');
  const card = read('components/lobby/game-card.tsx');
  assert.match(grid, /disabled=\{!canSelect \|\| !runtimeEnabled\}/);
  assert.match(card, /isUnavailable/);
  assert.match(card, /if \(isDisabled\)/);
});

test('19 safe Arabic GAME_DISABLED error', () => {
  const errors = read('lib/game-shell/error-messages.ts');
  const start = read('components/lobby/lobby-start-game-panel.tsx');
  assert.match(errors, /GAME_DISABLED: 'هذه اللعبة غير متاحة حالياً.'/);
  assert.match(start, /غير متاحة حالياً/);
});

test('Admin games page has مفعلة / متوقفة toggles', () => {
  const page = read('components/admin/admin-games-client.tsx');
  assert.match(page, /PLAYABLE_GAME_IDS/);
  assert.match(page, /patchAdminGameAvailability/);
  assert.match(page, /ADMIN_COPY\.gameEnabled/);
  assert.match(page, /ADMIN_COPY\.gameDisabled/);
  assert.equal(ADMIN_COPY.gameEnabled, 'مفعلة');
  assert.equal(ADMIN_COPY.gameDisabled, 'متوقفة');
  assert.doesNotMatch(page, /onChange/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
