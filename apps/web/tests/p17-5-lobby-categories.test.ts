/**
 * P17.5 hotfix — one selected game renders one category/settings UI.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  FAST_ANSWER_GAME_ID,
  GUESSING_CHALLENGE_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  JUDGE_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
  WHO_WROTE_IT_GAME_ID,
} from '@wanasatna/shared';
import { getGameRoundCategories } from '@/lib/game/round-categories/registry';

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

function labels(gameId: string): string[] {
  return (getGameRoundCategories(gameId)?.categories ?? []).map((category) => category.label);
}

test('1 exactly one game setup slot in Lobby', () => {
  const lobby = read('components/lobby/lobby-screen.tsx');
  const setup = read('components/lobby/lobby-selected-game-setup.tsx');
  assert.equal((lobby.match(/<LobbySelectedGameSetup/g) ?? []).length, 1);
  assert.match(lobby, /key=\{selectedGameId \?\? 'none'\}/);
  assert.doesNotMatch(lobby, /<RoundCategoryPanel/);
  assert.doesNotMatch(lobby, /<GameSettingsPanel/);
  assert.equal((setup.match(/<RoundCategoryPanel/g) ?? []).length, 1);
  assert.equal((setup.match(/<GameSettingsPanel/g) ?? []).length, 1);
  assert.doesNotMatch(setup, /mockLobbyGames\.map/);
  assert.doesNotMatch(setup, /Object\.values/);
});

test('2 Fast Answer does not render Judge categories', () => {
  const fa = labels(FAST_ANSWER_GAME_ID);
  assert.equal(fa.includes('مواقف مضحكة'), false);
  assert.equal(fa.includes('مواقف افتراضية'), false);
  assert.equal(fa.includes('الحياة اليومية'), false);
  assert.equal(fa.includes('مواقف غريبة'), false);
});

test('3 Fast Answer does not render Who Wrote It categories', () => {
  const fa = labels(FAST_ANSWER_GAME_ID);
  assert.equal(fa.includes('أسئلة مضحكة'), false);
  assert.equal(fa.includes('أسئلة شخصية'), false);
  assert.equal(fa.includes('تفضيلات'), false);
});

test('4 Fast Answer does not render Guessing Challenge extra categories', () => {
  const fa = labels(FAST_ANSWER_GAME_ID);
  assert.equal(fa.includes('أغراض منزلية'), false);
  assert.equal(fa.includes('أدوات'), false);
  const settings = read('components/lobby/game-settings-panel.tsx');
  assert.match(settings, /isGuessingChallenge \? \(/);
  assert.match(settings, /selectedGame\?\.id === GUESSING_CHALLENGE_GAME_ID/);
});

test('5 Guessing Challenge settings only when Guessing Challenge is selected', () => {
  const settings = read('components/lobby/game-settings-panel.tsx');
  assert.match(settings, /isGuessingChallenge \? \(\s*<GuessingChallengeSettingsPanel/);
  assert.match(settings, /teamSnapshot\?\.gameId === selectedGame\.id/);
  assert.equal(getGameRoundCategories(GUESSING_CHALLENGE_GAME_ID)?.categories.some((c) => c.label === 'أغراض منزلية'), true);
  assert.equal(getGameRoundCategories(FAST_ANSWER_GAME_ID)?.categories.some((c) => c.label === 'أغراض منزلية'), false);
});

test('6 Judge categories only resolve for Judge', () => {
  const judge = labels(JUDGE_GAME_ID);
  assert.equal(judge.includes('مواقف مضحكة'), true);
  assert.equal(labels(FAST_ANSWER_GAME_ID).includes('مواقف مضحكة'), false);
  assert.equal(labels(WHO_WROTE_IT_GAME_ID).includes('مواقف مضحكة'), false);
  assert.equal(labels(BARA_AL_SALAFA_GAME_ID).includes('مواقف مضحكة'), false);
});

test('7 Who Wrote It categories only resolve for Who Wrote It', () => {
  const wwi = labels(WHO_WROTE_IT_GAME_ID);
  assert.equal(wwi.includes('أسئلة مضحكة'), true);
  assert.equal(labels(FAST_ANSWER_GAME_ID).includes('أسئلة مضحكة'), false);
  assert.equal(labels(JUDGE_GAME_ID).includes('أسئلة مضحكة'), false);
});

test('8 A → B → A remounts a single keyed setup and resets category', () => {
  const lobby = read('components/lobby/lobby-screen.tsx');
  const room = read('contexts/room-context.tsx');
  assert.match(lobby, /key=\{selectedGameId \?\? 'none'\}/);
  assert.match(room, /setSelectedRoundCategoryId\(getDefaultRoundCategoryId\(gameId\)\)/);
  assert.match(room, /setTeamSnapshot\(null\)/);
});

test('9 return from active game does not lock leftover shell categories', () => {
  const setup = read('components/lobby/lobby-selected-game-setup.tsx');
  assert.match(setup, /isActiveMatch=\{isWaitingForNextMatch\}/);
  assert.doesNotMatch(setup, /activeMatchParticipantIds/);
});

test('10 category content itself is unchanged', () => {
  assert.deepEqual(labels(FAST_ANSWER_GAME_ID), labels(BARA_AL_SALAFA_GAME_ID));
  assert.equal(labels(WHO_WROTE_IT_GAME_ID).join('|'), 'أسئلة مضحكة|أسئلة شخصية|مواقف|تفضيلات|عشوائي');
  assert.equal(labels(JUDGE_GAME_ID).join('|'), 'مواقف مضحكة|مواقف افتراضية|الحياة اليومية|مواقف غريبة|عشوائي');
  assert.equal(getGameRoundCategories(TIMING_CHALLENGE_GAME_ID), null);
  assert.ok(getGameRoundCategories(DRAW_GUESS_GAME_ID));
  assert.ok(getGameRoundCategories(IMPOSTER_DRAW_GAME_ID));
  const panel = read('components/lobby/round-category-panel.tsx');
  assert.match(panel, /data-category-game=\{gameId\}/);
  assert.doesNotMatch(panel, /Object\.values|Object\.entries|mockLobbyGames\.map/);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
