/**
 * P8-B.1: per-game lobby category chips + virtual random.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BARA_AL_SALAFA_CONTENT_CATEGORY_IDS,
  BARA_AL_SALAFA_GAME_ID,
  DRAWABLE_CONTENT_CATEGORY_IDS,
  DRAWABLE_CONTENT_CATEGORY_LABELS,
  DRAW_GUESS_GAME_ID,
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_CONTENT_CATEGORY_IDS,
  GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS,
  GUESSING_CHALLENGE_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  JUDGE_CONTENT_CATEGORY_IDS,
  JUDGE_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
  VIRTUAL_RANDOM_CATEGORY_ID,
  WHO_WROTE_IT_CONTENT_CATEGORY_IDS,
  WHO_WROTE_IT_GAME_ID,
} from '@wanasatna/shared';
import { baraAlSalafaRoundCategories } from '@/lib/game/round-categories/bara-al-salafa';
import { drawableRoundCategories } from '@/lib/game/round-categories/drawable';
import { guessingChallengeRoundCategories } from '@/lib/game/round-categories/guessing-challenge';
import { getGameRoundCategories } from '@/lib/game/round-categories/registry';

const contentRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../content');

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

function contentIds(gameId: string): string[] {
  const config = getGameRoundCategories(gameId);
  assert.ok(config, gameId);
  return config.categories
    .map((category) => category.id)
    .filter((id) => id !== VIRTUAL_RANDOM_CATEGORY_ID);
}

test('Bara and Fast Answer use their approved packs + virtual random', () => {
  assert.deepEqual(
    [...contentIds(BARA_AL_SALAFA_GAME_ID)].sort(),
    [...BARA_AL_SALAFA_CONTENT_CATEGORY_IDS].sort(),
  );
  assert.deepEqual(
    [...contentIds(FAST_ANSWER_GAME_ID)].sort(),
    [...FAST_ANSWER_CONTENT_CATEGORY_IDS].sort(),
  );
  assert.equal(getGameRoundCategories(BARA_AL_SALAFA_GAME_ID)?.categories.length, 7);
  assert.equal(getGameRoundCategories(FAST_ANSWER_GAME_ID)?.categories.length, 6);
  assert.equal(baraAlSalafaRoundCategories.defaultCategoryId, VIRTUAL_RANDOM_CATEGORY_ID);
});

test('Draw and Imposter use approved drawable 5 + virtual random', () => {
  for (const gameId of [DRAW_GUESS_GAME_ID, IMPOSTER_DRAW_GAME_ID]) {
    const config = getGameRoundCategories(gameId);
    assert.ok(config, gameId);
    assert.equal(config.categories.length, 6, gameId);
    assert.deepEqual(
      [...contentIds(gameId)].sort(),
      [...DRAWABLE_CONTENT_CATEGORY_IDS].sort(),
      gameId,
    );
    const ids = config.categories.map((category) => category.id);
    assert.ok(!ids.includes('movies'), gameId);
    assert.ok(!ids.includes('series'), gameId);
    assert.ok(!ids.includes('games'), gameId);
    assert.ok(ids.includes('tech'), gameId);
  }
  assert.equal(drawableRoundCategories.defaultCategoryId, VIRTUAL_RANDOM_CATEGORY_ID);
  const nature = drawableRoundCategories.categories.find((category) => category.id === 'nature');
  assert.equal(nature?.label, 'طبيعة وفضاء وطقس');
  assert.equal(DRAWABLE_CONTENT_CATEGORY_LABELS.places, 'أماكن ومعالم واضحة');
});

test('GC shows approved 7 categories + virtual random', () => {
  const config = guessingChallengeRoundCategories;
  assert.equal(config.categories.length, 8);
  assert.deepEqual(
    [...contentIds(GUESSING_CHALLENGE_GAME_ID)].sort(),
    [...GUESSING_CHALLENGE_CONTENT_CATEGORY_IDS].sort(),
  );
  assert.ok(config.categories.some((category) => category.id === 'tech'));
  assert.ok(config.categories.some((category) => category.id === VIRTUAL_RANDOM_CATEGORY_ID));
});

test('WWI and Judge keep their prompt packs + virtual random', () => {
  assert.deepEqual(
    [...contentIds(WHO_WROTE_IT_GAME_ID)].sort(),
    [...WHO_WROTE_IT_CONTENT_CATEGORY_IDS].sort(),
  );
  assert.deepEqual([...contentIds(JUDGE_GAME_ID)].sort(), [...JUDGE_CONTENT_CATEGORY_IDS].sort());
  assert.equal(getGameRoundCategories(WHO_WROTE_IT_GAME_ID)?.categories.length, 5);
  assert.equal(getGameRoundCategories(JUDGE_GAME_ID)?.categories.length, 6);
});

test('Timing has no content category selector', () => {
  assert.equal(getGameRoundCategories(TIMING_CHALLENGE_GAME_ID), null);
});

test('random is not stored in content JSON', () => {
  const games = [
    BARA_AL_SALAFA_GAME_ID,
    DRAW_GUESS_GAME_ID,
    IMPOSTER_DRAW_GAME_ID,
    FAST_ANSWER_GAME_ID,
    GUESSING_CHALLENGE_GAME_ID,
    WHO_WROTE_IT_GAME_ID,
    JUDGE_GAME_ID,
  ];

  for (const gameId of games) {
    const categories = JSON.parse(
      readFileSync(join(contentRoot, gameId, 'categories.json'), 'utf8'),
    ) as Array<{ id: string }>;
    assert.ok(!categories.some((category) => category.id === VIRTUAL_RANDOM_CATEGORY_ID), gameId);
  }
});

test('every lobby chip maps to a stored category or virtual random', () => {
  const games = [
    BARA_AL_SALAFA_GAME_ID,
    DRAW_GUESS_GAME_ID,
    IMPOSTER_DRAW_GAME_ID,
    FAST_ANSWER_GAME_ID,
    GUESSING_CHALLENGE_GAME_ID,
    WHO_WROTE_IT_GAME_ID,
    JUDGE_GAME_ID,
  ];

  for (const gameId of games) {
    const stored = new Set(
      (
        JSON.parse(readFileSync(join(contentRoot, gameId, 'categories.json'), 'utf8')) as Array<{
          id: string;
        }>
      ).map((category) => category.id),
    );
    const config = getGameRoundCategories(gameId);
    assert.ok(config, gameId);

    for (const category of config.categories) {
      if (category.id === VIRTUAL_RANDOM_CATEGORY_ID) {
        continue;
      }
      assert.ok(stored.has(category.id), `${gameId} lobby chip ${category.id} missing from JSON`);
    }
  }

  assert.equal(getGameRoundCategories(TIMING_CHALLENGE_GAME_ID), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
