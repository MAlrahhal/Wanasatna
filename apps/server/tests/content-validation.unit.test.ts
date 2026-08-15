/**
 * P8-B content validation unit tests (synthetic bundles).
 * Run: pnpm --filter @wanasatna/server exec tsx tests/content-validation.unit.test.ts
 */
import assert from 'node:assert/strict';
import {
  DRAWABLE_CONTENT_CATEGORY_IDS,
  DRAWABLE_CONTENT_CATEGORY_LABELS,
  TRIVIA_CONTENT_CATEGORY_IDS,
  TRIVIA_CONTENT_CATEGORY_LABELS,
  VIRTUAL_RANDOM_CATEGORY_ID,
  normalizeAcceptedAnswerKey,
  normalizeCanonicalEntryKey,
  validateContentBundle,
  type GameContentBundle,
  type GameContentCategory,
} from '@wanasatna/shared';
import { normalizeAnswerText } from '../src/modules/game/plugins/fast-answer/answers.js';

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

function sharedCategories(): GameContentCategory[] {
  return TRIVIA_CONTENT_CATEGORY_IDS.map((id) => ({
    id,
    name: TRIVIA_CONTENT_CATEGORY_LABELS[id],
    enabled: true,
  }));
}

function drawableCategories(): GameContentCategory[] {
  return DRAWABLE_CONTENT_CATEGORY_IDS.map((id) => ({
    id,
    name: DRAWABLE_CONTENT_CATEGORY_LABELS[id],
    enabled: true,
  }));
}

function bundle(overrides: Partial<GameContentBundle>): GameContentBundle {
  return {
    gameId: 'unit-test',
    categories: [{ id: 'animals', name: 'حيوانات', enabled: true }],
    words: [{ id: 'w1', text: 'أسد', categoryId: 'animals' }],
    ...overrides,
  };
}

function sharedBundle(overrides: Partial<GameContentBundle>): GameContentBundle {
  return {
    gameId: 'fast-answer',
    categories: sharedCategories(),
    words: [],
    questions: [
      {
        id: 'q1',
        categoryId: 'animals',
        question: 'من ملك الغابة؟',
        acceptedAnswers: ['أسد', 'الأسد'],
      },
    ],
    ...overrides,
  };
}

test('matching-key stays aligned with Fast Answer normalizeAnswerText', () => {
  const samples = [
    'أسد',
    'الأسد',
    'الاسد',
    'زرافة',
    "grey's anatomy",
    'كأس-العالم',
    'BMW',
    'آبل',
    'أبل',
    'مستشفى',
  ];

  for (const sample of samples) {
    assert.equal(normalizeAcceptedAnswerKey(sample), normalizeAnswerText(sample), sample);
  }
});

test('matching-key does not fold ة→ه', () => {
  assert.notEqual(normalizeAcceptedAnswerKey('زرافة'), normalizeAcceptedAnswerKey('زرافه'));
});

test('canonical key folds ة→ه', () => {
  assert.equal(normalizeCanonicalEntryKey('زرافة'), normalizeCanonicalEntryKey('زرافه'));
});

test('duplicate category ids fail with game id', () => {
  const result = validateContentBundle(
    bundle({
      gameId: 'unit-test',
      categories: [
        { id: 'animals', name: 'حيوانات', enabled: true },
        { id: 'animals', name: 'حيوانات', enabled: true },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('[unit-test]')));
  assert.ok(result.errors.some((error) => error.includes('Duplicate category id: animals')));
});

test('duplicate word ids fail with game id', () => {
  const result = validateContentBundle(
    bundle({
      words: [
        { id: 'animals-1', text: 'أسد', categoryId: 'animals' },
        { id: 'animals-1', text: 'فيل', categoryId: 'animals' },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('[unit-test] Duplicate word id: animals-1')));
});

test('duplicate question ids fail with game id', () => {
  const result = validateContentBundle(
    sharedBundle({
      questions: [
        {
          id: 'animals-1',
          categoryId: 'animals',
          question: 'سؤال أ',
          acceptedAnswers: ['أسد'],
        },
        {
          id: 'animals-1',
          categoryId: 'animals',
          question: 'سؤال ب',
          acceptedAnswers: ['فيل'],
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes('[fast-answer] Duplicate question id: animals-1')),
  );
});

test('normalized canonical word duplicates fail', () => {
  const result = validateContentBundle(
    bundle({
      words: [
        { id: 'w1', text: 'أسد', categoryId: 'animals' },
        { id: 'w2', text: 'اسد', categoryId: 'animals' },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Duplicate canonical word text')));
  assert.ok(result.errors.some((error) => error.includes('w1')));
  assert.ok(result.errors.some((error) => error.includes('w2')));
});

test('whitespace/punctuation canonical duplicates fail', () => {
  const result = validateContentBundle(
    bundle({
      words: [
        { id: 'w1', text: 'Hello World', categoryId: 'animals' },
        { id: 'w2', text: 'hello   world!', categoryId: 'animals' },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Duplicate canonical word text')));
});

test('empty accepted answer fails', () => {
  const result = validateContentBundle(
    sharedBundle({
      questions: [
        {
          id: 'q1',
          categoryId: 'animals',
          question: 'من ملك الغابة؟',
          acceptedAnswers: ['أسد', '  '],
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('accepted answer #2 must have text')));
});

test('normalized duplicate aliases fail', () => {
  const result = validateContentBundle(
    sharedBundle({
      questions: [
        {
          id: 'q1',
          categoryId: 'animals',
          question: 'من ملك الغابة؟',
          acceptedAnswers: ['أسد', 'اسد'],
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('duplicate accepted answers after normalization')));
});

test('GC canonical identity must be accepted', () => {
  const result = validateContentBundle(
    sharedBundle({
      gameId: 'guessing-challenge',
      questions: [
        {
          id: 'animals-lion',
          categoryId: 'animals',
          question: 'أسد',
          acceptedAnswers: ['الأسد'],
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('canonical text is not an accepted answer')));
});

test('GC alias collisions across identities fail', () => {
  const result = validateContentBundle(
    sharedBundle({
      gameId: 'guessing-challenge',
      questions: [
        {
          id: 'id-a',
          categoryId: 'football',
          question: 'ليونيل ميسي',
          acceptedAnswers: ['ليونيل ميسي', 'ميسي'],
        },
        {
          id: 'id-b',
          categoryId: 'football',
          question: 'لاعب آخر',
          acceptedAnswers: ['لاعب آخر', 'ميسي'],
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Accepted-answer collision')));
  assert.ok(result.errors.some((error) => error.includes('id-a')));
  assert.ok(result.errors.some((error) => error.includes('id-b')));
});

test('random is not a stored content category', () => {
  const result = validateContentBundle(
    bundle({
      categories: [
        { id: 'animals', name: 'حيوانات', enabled: true },
        { id: VIRTUAL_RANDOM_CATEGORY_ID, name: 'عشوائي', enabled: true },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('virtual UI option')));
});

test('fast-answer cannot drift from its trivia category pack', () => {
  const result = validateContentBundle(
    sharedBundle({
      categories: [
        ...sharedCategories(),
        { id: 'space', name: 'فضاء', enabled: true },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('unexpected: space')));
});

test('draw-guess cannot keep movie title categories', () => {
  const result = validateContentBundle({
    gameId: 'draw-guess',
    categories: [
      ...drawableCategories(),
      { id: 'movies', name: 'أفلام', enabled: true },
    ],
    words: [{ id: 'w1', text: 'أسد', categoryId: 'animals' }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('unexpected: movies')));
});

test('movie canonical display must be Latin-script', () => {
  const result = validateContentBundle(
    sharedBundle({
      gameId: 'bara-al-salafa',
      words: [{ id: 'movies-1', text: 'الجوكر', categoryId: 'movies' }],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('Latin-script')));
});

test('extreme length fails; current-style length would pass', () => {
  const longQuestion = 'س'.repeat(161);
  const result = validateContentBundle(
    sharedBundle({
      questions: [
        {
          id: 'q-long',
          categoryId: 'animals',
          question: longQuestion,
          acceptedAnswers: ['أسد'],
        },
      ],
    }),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('exceeds 160 characters')));
});

test('valid shared bundle passes', () => {
  const result = validateContentBundle(sharedBundle({}));
  assert.equal(result.valid, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
