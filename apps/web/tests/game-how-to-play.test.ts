/**
 * Shared in-game "شرح اللعبة" navbar + static copy contract.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYABLE_GAME_IDS } from '@wanasatna/shared';
import {
  HOW_TO_PLAY_BUTTON_LABEL,
  flattenHowToPlayText,
  getHowToPlayGuide,
  listHowToPlayGameIds,
} from '../lib/game/how-to-play';

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

const EXPECTED_COPY: Record<string, string[]> = {
  'bara-al-salafa': ['برا السالفة', 'داخل السالفة', 'برا السالفة', '100'],
  'draw-guess': ['ارسم وخمن', 'الرسّام', 'يخمنون', '100'],
  'imposter-draw': ['الإمبوستر بالرسم', 'جزء من الرسمة', 'الإمبوستر', '100'],
  'timing-challenge': ['تحدي التوقيت', 'تخمين الوقت', 'إيقاف المؤقت', '100', '75', '50', '25'],
  'fast-answer': ['أسرع إجابة', 'كل إجابة صحيحة', '100', '75', '50', '25', 'ينتهي الوقت'],
  'who-wrote-it': ['من كتبها؟', 'بدون أسماء', '100'],
  judge: ['القاضي', 'ما يكتب', '100'],
  'guessing-challenge': ['تحدي التخمين', 'الصفراء', 'الحمراء', '2 ضد 2', '100'],
};

const LIVE_SECRET_PATTERNS = [
  /secretWord/,
  /impostorPlayerId/,
  /displayText/,
  /referenceImage/,
  /civilianWord/,
  /outsiderConcept/,
  /acceptedAnswers/,
  /identitiesByTeamId/,
  /winnerPlayerId/,
  /\$\{/,
  /view\./,
  /match\./,
  /round\./,
];

test('game navbar shows شرح اللعبة for everyone', () => {
  const header = read('components/game-experience/game-experience-header.tsx');
  const ui = read('components/game/game-how-to-play.tsx');
  const copy = read('lib/game/how-to-play.ts');
  assert.equal(HOW_TO_PLAY_BUTTON_LABEL, 'شرح اللعبة');
  assert.match(copy, /شرح اللعبة/);
  assert.match(ui, /HOW_TO_PLAY_BUTTON_LABEL/);
  assert.match(ui, /data-testid="game-how-to-play-button"/);
  assert.match(header, /from '@\/components\/game\/game-how-to-play'/);
  assert.match(header, /<GameHowToPlayControl gameId=\{gameId\} compact \/>/);
  assert.match(header, /<GameHowToPlayControl gameId=\{gameId\} \/>/);
  assert.match(header, /shellState\?\.gameId/);
  assert.doesNotMatch(header, /isHost &&[\s\S]{0,80}GameHowToPlayControl/);
  assert.doesNotMatch(header, /howToPlay.*isSpectator/);
});

test('how-to dialog opens and closes without touching game state', () => {
  const ui = read('components/game/game-how-to-play.tsx');
  const header = read('components/game-experience/game-experience-header.tsx');
  assert.match(ui, /HOW_TO_PLAY_BUTTON_LABEL/);
  assert.match(ui, /setOpen\(true\)/);
  assert.match(ui, /onClose=\{\(\) => setOpen\(false\)\}/);
  assert.match(ui, /event\.key === 'Escape'/);
  assert.match(ui, /data-testid="game-how-to-play-backdrop"/);
  assert.match(ui, /data-testid="game-how-to-play-close"/);
  assert.match(ui, /if \(!open\) \{\s*return null;/);
  assert.doesNotMatch(ui, /emit\(|submitVote|secretWord|setExperienceMeta/);
  assert.doesNotMatch(header, /GameHowToPlayDialog/);
});

test('each playable game has the matching static how-to copy', () => {
  assert.deepEqual([...listHowToPlayGameIds()], [...PLAYABLE_GAME_IDS]);

  for (const gameId of PLAYABLE_GAME_IDS) {
    const guide = getHowToPlayGuide(gameId);
    assert.ok(guide, gameId);
    assert.equal(guide.gameId, gameId);
    const text = flattenHowToPlayText(guide);
    assert.match(text, /🎯 فكرة اللعبة/);
    assert.match(text, /🎮 طريقة اللعب/);
    assert.match(text, /🏆 النقاط/);
    for (const snippet of EXPECTED_COPY[gameId] ?? []) {
      assert.ok(text.includes(snippet), `${gameId} missing: ${snippet}`);
    }
  }

  const bara = getHowToPlayGuide('bara-al-salafa');
  assert.ok(bara?.sections.some((section) => section.id === 'roles'));
  assert.equal(
    getHowToPlayGuide('draw-guess')?.sections.some((section) => section.id === 'cards'),
    false,
  );
  assert.ok(
    getHowToPlayGuide('guessing-challenge')?.sections.some((section) => section.id === 'cards'),
  );
  assert.equal(getHowToPlayGuide('not-a-game'), null);
});

test('how-to copy has no live-round secrets or dynamic match fields', () => {
  const source = read('lib/game/how-to-play.ts');
  assert.doesNotMatch(source, /from '@\/plugins\//);
  assert.doesNotMatch(source, /PlayerView/);

  for (const gameId of PLAYABLE_GAME_IDS) {
    const guide = getHowToPlayGuide(gameId);
    assert.ok(guide);
    const text = flattenHowToPlayText(guide);
    for (const pattern of LIVE_SECRET_PATTERNS) {
      assert.doesNotMatch(text, pattern, `${gameId} leaked ${pattern}`);
    }
    assert.doesNotMatch(text, /socket|pluginState|deadlineAtMs/i);
  }
});

test('shared how-to system is not duplicated inside game plugins', () => {
  const header = read('components/game-experience/game-experience-header.tsx');
  assert.match(header, /GameHowToPlayControl/);

  const pluginScreens = [
    'plugins/bara-al-salafa/game-screen.tsx',
    'plugins/draw-guess/game-screen.tsx',
    'plugins/imposter-draw/game-screen.tsx',
    'plugins/timing-challenge/game-screen.tsx',
    'plugins/fast-answer/game-screen.tsx',
    'plugins/who-wrote-it/game-screen.tsx',
    'plugins/judge/game-screen.tsx',
    'plugins/guessing-challenge/game-screen.tsx',
  ];

  for (const path of pluginScreens) {
    const source = read(path);
    assert.doesNotMatch(source, /GameHowToPlay/);
    assert.doesNotMatch(source, /شرح اللعبة/);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
