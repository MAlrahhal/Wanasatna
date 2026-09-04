/**
 * P8-B / P8-B.1 / P8-C content contract tests against shipped JSON catalogs.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/content-contract.unit.test.ts
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BARA_AL_SALAFA_CONTENT_CATEGORY_IDS,
  DRAWABLE_CONTENT_CATEGORY_IDS,
  FAST_ANSWER_CONTENT_CATEGORY_IDS,
  GAME_CONTENT_CATEGORY_CONTRACTS,
  GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS,
  JUDGE_CONTENT_CATEGORY_IDS,
  VIRTUAL_RANDOM_CATEGORY_ID,
  WHO_WROTE_IT_CONTENT_CATEGORY_IDS,
  canonicalHasArabicScript,
  canonicalHasLatinScript,
  getGameContentCategoryContract,
  validateContentBundle,
  type GameContentBundle,
} from '@wanasatna/shared';
import { loadGameContentBundle } from '../src/modules/content/loader.js';
import { registerAllGameContent } from '../src/modules/content/registry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTENT_ROOT = join(HERE, '../../../content');
const SERVER_ROOT = join(HERE, '..');
const QUESTION_GAMES = new Set(['fast-answer', 'guessing-challenge']);

const ALL_CONTENT_GAMES = [
  'bara-al-salafa',
  'draw-guess',
  'imposter-draw',
  'fast-answer',
  'who-wrote-it',
  'judge',
  'guessing-challenge',
] as const;

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

function readJson<T>(gameId: string, fileName: string): T {
  return JSON.parse(readFileSync(join(CONTENT_ROOT, gameId, fileName), 'utf8')) as T;
}

function expectPack(gameId: string, expected: readonly string[]): void {
  const categories = readJson<Array<{ id: string }>>(gameId, 'categories.json');
  const ids = categories.map((category) => category.id).sort();
  assert.deepEqual(ids, [...expected].sort(), gameId);
  assert.ok(!ids.includes(VIRTUAL_RANDOM_CATEGORY_ID), gameId);
}

test('all content bundles load and pass validation', () => {
  for (const gameId of ALL_CONTENT_GAMES) {
    const loaded = loadGameContentBundle(gameId);
    const result = validateContentBundle(loaded);
    assert.equal(result.valid, true, `${gameId}: ${result.valid ? '' : result.errors.join(' | ')}`);
  }
});

test('per-game category contracts — no global shared 9', () => {
  assert.equal(BARA_AL_SALAFA_CONTENT_CATEGORY_IDS.length, 6);
  assert.equal(FAST_ANSWER_CONTENT_CATEGORY_IDS.length, 5);
  assert.equal(DRAWABLE_CONTENT_CATEGORY_IDS.length, 5);
  assert.equal(GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS.length, 7);
  assert.equal(WHO_WROTE_IT_CONTENT_CATEGORY_IDS.length, 4);
  assert.equal(JUDGE_CONTENT_CATEGORY_IDS.length, 5);
  assert.equal(getGameContentCategoryContract('timing-challenge'), null);
  assert.ok(!('timing-challenge' in GAME_CONTENT_CATEGORY_CONTRACTS));
});

test('each game matches its own category pack', () => {
  expectPack('bara-al-salafa', BARA_AL_SALAFA_CONTENT_CATEGORY_IDS);
  expectPack('fast-answer', FAST_ANSWER_CONTENT_CATEGORY_IDS);
  expectPack('draw-guess', DRAWABLE_CONTENT_CATEGORY_IDS);
  expectPack('imposter-draw', DRAWABLE_CONTENT_CATEGORY_IDS);
  expectPack('guessing-challenge', GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS);
  expectPack('who-wrote-it', WHO_WROTE_IT_CONTENT_CATEGORY_IDS);
  expectPack('judge', JUDGE_CONTENT_CATEGORY_IDS);
});

test('every expected category has at least one item', () => {
  for (const gameId of ALL_CONTENT_GAMES) {
    const contract = getGameContentCategoryContract(gameId);
    assert.ok(contract, gameId);
    const bundle = loadGameContentBundle(gameId);

    for (const id of contract.ids) {
      const hasContent =
        bundle.words.some((word) => word.categoryId === id) ||
        (bundle.questions ?? []).some((question) => question.categoryId === id);
      assert.ok(hasContent, `${gameId} ${id}`);
    }
  }
});

test('random is never persisted in content JSON', () => {
  for (const gameId of ALL_CONTENT_GAMES) {
    const categories = readJson<Array<{ id: string }>>(gameId, 'categories.json');
    assert.ok(
      !categories.some((category) => category.id === VIRTUAL_RANDOM_CATEGORY_ID),
      `${gameId} categories.json`,
    );

    const words = readJson<Array<{ categoryId: string }>>(gameId, 'words.json');
    assert.ok(
      !words.some((word) => word.categoryId === VIRTUAL_RANDOM_CATEGORY_ID),
      `${gameId} words.json`,
    );

    try {
      const questions = readJson<Array<{ categoryId: string }>>(gameId, 'questions.json');
      assert.ok(
        !questions.some((question) => question.categoryId === VIRTUAL_RANDOM_CATEGORY_ID),
        `${gameId} questions.json`,
      );
    } catch {
      // questions.json is optional
    }
  }
});

test('item category IDs are valid and values are non-empty', () => {
  for (const gameId of ALL_CONTENT_GAMES) {
    const bundle = loadGameContentBundle(gameId);
    const categoryIds = new Set(bundle.categories.map((category) => category.id));

    for (const word of bundle.words) {
      assert.ok(word.id.trim(), `${gameId} word id`);
      assert.ok(word.text.trim(), `${gameId} ${word.id}`);
      assert.ok(categoryIds.has(word.categoryId), `${gameId} ${word.id} category`);
    }

    for (const question of bundle.questions ?? []) {
      assert.ok(question.id.trim(), `${gameId} question id`);
      assert.ok(question.question.trim(), `${gameId} ${question.id}`);
      assert.ok(categoryIds.has(question.categoryId), `${gameId} ${question.id} category`);
      assert.ok((question.acceptedAnswers?.length ?? 0) > 0, `${gameId} ${question.id} answers`);
    }
  }
});

test('GC identities have no cross-identity alias collisions', () => {
  const result = validateContentBundle(loadGameContentBundle('guessing-challenge'));
  assert.equal(result.valid, true);
});

test('language policy: movies/series/games Latin, Arabic categories Arabic', () => {
  const bara = loadGameContentBundle('bara-al-salafa');
  const series = bara.words.filter((word) => word.categoryId === 'series');
  const animals = bara.words.filter((word) => word.categoryId === 'animals');
  assert.ok(series.length > 0);
  assert.ok(series.every((word) => canonicalHasLatinScript(word.text)));
  assert.ok(animals.every((word) => canonicalHasArabicScript(word.text)));

  const fa = loadGameContentBundle('fast-answer');
  const breaking = (fa.questions ?? []).find((question) => question.id === 'series-1');
  const minecraft = (fa.questions ?? []).find((question) => question.id === 'games-1');
  assert.equal(breaking?.acceptedAnswers[0], 'Breaking Bad');
  assert.equal(minecraft?.acceptedAnswers[0], 'Minecraft');

  const gc = loadGameContentBundle('guessing-challenge');
  const gcBreaking = (gc.questions ?? []).find((question) => question.id === 'series-1');
  const ronaldo = (gc.questions ?? []).find((question) => question.id === 'football-1');
  const iphone = (gc.questions ?? []).find((question) => question.id === 'tech-1');
  assert.equal(gcBreaking?.question, 'Breaking Bad');
  assert.equal(ronaldo?.question, 'كريستيانو رونالدو');
  assert.equal(iphone?.question, 'آيفون');
  assert.ok(canonicalHasArabicScript(ronaldo?.question ?? ''));
});

test('draw and imposter catalogs are drawable — no title categories', () => {
  const banned = [
    'movies',
    'series',
    'games',
    'cars',
    'football',
    'countries',
    'household',
    'tools',
    'transport',
    'professions',
    'sports',
    'clothing',
  ];

  for (const gameId of ['draw-guess', 'imposter-draw'] as const) {
    const ids = readJson<Array<{ id: string }>>(gameId, 'categories.json').map(
      (category) => category.id,
    );
    for (const categoryId of banned) {
      assert.ok(!ids.includes(categoryId), `${gameId} still has ${categoryId}`);
    }

    const bundle = loadGameContentBundle(gameId);
    for (const word of bundle.words) {
      assert.ok(
        (DRAWABLE_CONTENT_CATEGORY_IDS as readonly string[]).includes(word.categoryId),
        `${gameId} ${word.id} category ${word.categoryId}`,
      );
      assert.ok(!banned.includes(word.categoryId), `${gameId} ${word.id} banned category`);
      assert.ok(word.text.trim().length > 0, `${gameId} ${word.id} empty`);
    }
  }
});

  test('approved catalog counts stay at or above the curated baseline', () => {
  const expected: Record<string, Record<string, number>> = {
    'bara-al-salafa': { animals: 20, food: 20, countries: 20, football: 20, series: 20, games: 20 },
    'draw-guess': { animals: 20, food: 20, nature: 20, places: 19, tech: 19 },
    'imposter-draw': { animals: 20, food: 20, nature: 20, places: 19, tech: 19 },
    'fast-answer': { animals: 20, food: 17, countries: 20, series: 20, games: 20 },
    'guessing-challenge': {
      animals: 20,
      food: 20,
      countries: 20,
      football: 20,
      series: 20,
      games: 20,
      tech: 18,
    },
    'who-wrote-it': {
      'funny-situations': 15,
      confessions: 15,
      'light-personal': 15,
      'what-would-you-do': 15,
    },
    judge: {
      'worst-answer': 15,
      'invent-something-silly': 15,
      'weird-scenarios': 15,
      'complete-the-sentence': 15,
      'rapid-response': 15,
    },
  };

  for (const [gameId, categories] of Object.entries(expected)) {
    const bundle = loadGameContentBundle(gameId);
    for (const [categoryId, expectedCount] of Object.entries(categories)) {
      const count = QUESTION_GAMES.has(gameId)
        ? (bundle.questions ?? []).filter((question) => question.categoryId === categoryId).length
        : bundle.words.filter((word) => word.categoryId === categoryId).length;
      assert.ok(
        count >= expectedCount,
        `${gameId} ${categoryId} expected at least ${expectedCount}, got ${count}`,
      );
    }
  }
});

test('owner review export covers every production item', () => {
  execSync('node scripts/export-content-review.mjs', {
    cwd: SERVER_ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  let production = 0;
  for (const gameId of ALL_CONTENT_GAMES) {
    const bundle = loadGameContentBundle(gameId);
    production += QUESTION_GAMES.has(gameId)
      ? (bundle.questions ?? []).length
      : bundle.words.length;
  }

  const csv = readFileSync(join(CONTENT_ROOT, 'review/OWNER_REVIEW.csv'), 'utf8');
  const markdown = readFileSync(join(CONTENT_ROOT, 'review/OWNER_REVIEW.md'), 'utf8');
  const csvRows = csv.trimEnd().split(/\r?\n/).length - 1;
  const markers = markdown.match(/\[ \] KEEP/g)?.length ?? 0;

  assert.equal(csvRows, production, 'CSV rows must equal production items');
  assert.equal(markers, production, 'Markdown markers must equal production items');
  assert.equal(markdown.includes('and 50 more'), false);
});

test('style targets: FA questions stay under 120 chars; drawable words under 24', () => {
  const fa = loadGameContentBundle('fast-answer');
  for (const question of fa.questions ?? []) {
    assert.ok(question.question.length <= 120, `${question.id} length ${question.question.length}`);
  }

  for (const gameId of ['draw-guess', 'imposter-draw', 'bara-al-salafa'] as const) {
    const bundle = loadGameContentBundle(gameId);
    for (const word of bundle.words) {
      assert.ok(word.text.length <= 24, `${gameId} ${word.id} "${word.text}"`);
    }
  }

  const gc = loadGameContentBundle('guessing-challenge');
  for (const question of gc.questions ?? []) {
    assert.ok(question.question.length <= 32, `${question.id} "${question.question}"`);
  }
});

test('registerAllGameContent boots every catalog', () => {
  registerAllGameContent();
  for (const gameId of ALL_CONTENT_GAMES) {
    const loaded: GameContentBundle = loadGameContentBundle(gameId);
    assert.equal(validateContentBundle(loaded).valid, true, gameId);
  }
});

test('empty FA/GC words.json remain loader-required placeholders', () => {
  const faWords = readJson<unknown[]>('fast-answer', 'words.json');
  const gcWords = readJson<unknown[]>('guessing-challenge', 'words.json');
  assert.deepEqual(faWords, []);
  assert.deepEqual(gcWords, []);
  assert.equal(loadGameContentBundle('fast-answer').words.length, 0);
  assert.equal(loadGameContentBundle('guessing-challenge').words.length, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
