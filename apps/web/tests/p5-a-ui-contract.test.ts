/**
 * P5-A shared primitive + experience-shell contract tests.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeExperiencePhaseLabel } from '../lib/game/experience-meta';
import { competitionDisplayRanks } from '../lib/game/leaderboard-sort';

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

test('primary button keeps white CTA text', () => {
  const button = read('components/ui/button.tsx');
  assert.match(button, /primary:\s*'[\s\S]*text-white/);
  assert.match(button, /disabled:opacity-40/);
  assert.match(button, /destructive:/);
  assert.match(button, /spinnerClasses/);
  assert.match(button, /border-wanas-error\/30 border-t-wanas-error/);
  assert.match(button, /border-white\/35 border-t-white/);
});

test('phase label strips duplicated round suffix', () => {
  assert.equal(normalizeExperiencePhaseLabel('التخمين — الجولة 2/4'), 'التخمين');
  assert.equal(normalizeExperiencePhaseLabel('دور الرسم - الجولة 1/3'), 'دور الرسم');
  assert.equal(normalizeExperiencePhaseLabel('دورك'), 'دورك');
});

test('spectator header label standardizes to مشاهدة', () => {
  assert.equal(normalizeExperiencePhaseLabel('الجولة جارية'), 'مشاهدة');
  assert.equal(normalizeExperiencePhaseLabel('الجولة جارية 👀'), 'مشاهدة');
  assert.equal(normalizeExperiencePhaseLabel('مشاهدة'), 'مشاهدة');
});

test('header uses one center slot and no absolute overlap', () => {
  const header = read('components/game-experience/game-experience-header.tsx');
  assert.match(header, /normalizeExperiencePhaseLabel/);
  assert.match(header, /primaryCenter/);
  assert.match(header, /secondaryChip/);
  assert.doesNotMatch(header, /absolute left-1\/2/);
  assert.doesNotMatch(header, /⚙/);
});

test('leaderboard indicates current player and avoids fake equal ranks', () => {
  const panel = read('components/game-experience/game-leaderboard-panel.tsx');
  assert.match(panel, /isCurrentPlayer/);
  assert.match(panel, /أنت/);
  assert.match(panel, /competitionDisplayRanks/);
  assert.deepEqual(competitionDisplayRanks([0, 0]), [null, null]);
  assert.deepEqual(competitionDisplayRanks([100, 50]), [1, 2]);
});

test('chat placeholder is honest and has no LTR send affordance', () => {
  const gameChat = read('components/game-experience/game-chat-mock-panel.tsx');
  const lobbyChat = read('components/lobby/lobby-chat.tsx');
  assert.match(gameChat, /غير متاحة حالياً/);
  assert.match(lobbyChat, /غير متاحة حالياً/);
  assert.doesNotMatch(gameChat, /➤/);
  assert.doesNotMatch(lobbyChat, /➤/);
  assert.doesNotMatch(gameChat, /MOCK_MESSAGES/);
  assert.doesNotMatch(lobbyChat, /handleSendMessage/);
});

test('legacy English Game Shell copy is gone from user UI', () => {
  const shell = read('components/game-shell/game-shell-screen.tsx');
  const page = read('app/(room)/game/game-page-client.tsx');
  assert.doesNotMatch(shell, /Game Shell/);
  assert.match(shell, /إطار اللعبة/);
  assert.doesNotMatch(page, /shell اللعبة/);
});

test('shared field uses cyan focus on the dark theme', () => {
  const field = read('components/ui/field.tsx');
  assert.match(field, /focus:border-wanas-accent/);
  assert.match(field, /focus:ring-wanas-accent/);
  assert.match(field, /dir="rtl"/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
