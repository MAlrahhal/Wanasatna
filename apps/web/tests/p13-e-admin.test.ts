/**
 * P13-E — Admin experimental game settings UI contracts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_NAV_ITEMS, ADMIN_ROUTES } from '../lib/admin/routes';
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

test('Admin lobby shows إعدادات تجريبية; Guest/USER sources do not render it unconditionally', () => {
  const panel = read('components/lobby/game-settings-panel.tsx');
  const experimental = read('components/lobby/experimental-game-settings-panel.tsx');
  assert.match(panel, /useAuth\(\)/);
  assert.match(panel, /user\?\.role === 'ADMIN'/);
  assert.match(panel, /ExperimentalGameSettingsPanel/);
  assert.match(experimental, /إعدادات تجريبية/);
  assert.match(experimental, /<select/);
  assert.doesNotMatch(experimental, /type="number"/);
  assert.match(experimental, /sm:grid-cols-2/);
  assert.doesNotMatch(panel, /Admin badge|شارة/);
});

test('experimental settings require ADMIN and current host', () => {
  const panel = read('components/lobby/game-settings-panel.tsx');
  assert.match(panel, /isAdmin && isHost && selectedGame/);
  assert.doesNotMatch(panel, /isAdmin && selectedGame \?/);
  assert.doesNotMatch(panel, /إعدادات تجريبية/);
});

test('client emits known keys only and listens for public snapshot', () => {
  const context = read('contexts/room-context.tsx');
  const manager = read('lib/room-v2/manager.ts');
  assert.match(context, /UPDATE_ROOM_GAME_SETTINGS_EVENT/);
  assert.match(context, /gameId, settings/);
  assert.match(manager, /ROOM_GAME_SETTINGS_UPDATED_EVENT/);
  assert.match(manager, /gameSettings: payload\.gameSettings/);
  assert.doesNotMatch(context, /role: 'ADMIN'|userId:/);
});

test('Admin Games page is read-only ranges, not a CMS', () => {
  assert.equal(ADMIN_ROUTES.games, '/admin/games');
  assert.equal(existsSync(join(root, 'app/admin/games/page.tsx')), true);
  const gamesNav = ADMIN_NAV_ITEMS.find((item) => item.id === 'games');
  assert.ok(gamesNav);
  assert.equal(gamesNav.placeholder, false);
  assert.equal(gamesNav.href, ADMIN_ROUTES.games);
  const page = read('components/admin/admin-games-client.tsx');
  assert.match(page, /ADMIN_GAME_SETTING_SPECS/);
  assert.match(page, /spec\.min}–{spec\.max/);
  assert.doesNotMatch(page, /onChange|updateRoomGameSettings|gameTimer/);
  assert.equal(ADMIN_COPY.experimentalSettings, 'إعدادات تجريبية');
});

test('existing host timing/draw/GC panels remain; no scoring/GC 2-4 edits', () => {
  const panel = read('components/lobby/game-settings-panel.tsx');
  const timing = read('components/lobby/timing-challenge-settings-panel.tsx');
  const gc = read('plugins/guessing-challenge/index.tsx');
  assert.match(panel, /TimingChallengeSettingsPanel/);
  assert.match(panel, /DrawGuessSettingsPanel/);
  assert.match(panel, /GuessingChallengeSettingsPanel/);
  assert.match(timing, /TIMING_CHALLENGE_ABSOLUTE_MAX_SECONDS/);
  assert.match(gc, /maxPlayers:\s*4/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
