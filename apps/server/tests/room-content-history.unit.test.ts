/**
 * Room-scoped content anti-repetition.
 * Run: pnpm --filter @wanasatna/server test:content-history
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameContentBundle, GameContentWord, GameShellPlayer } from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_GAME_ID,
  DRAW_GUESS_GAME_ID,
  GUESSING_CHALLENGE_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  normalizeCanonicalEntryKey,
} from '@wanasatna/shared';
import { registerGameContent } from '../src/modules/content/registry.js';
import { createMatchState as createBaraMatchState } from '../src/modules/game/plugins/bara-al-salafa/round-state.js';
import { createMatchState as createDrawMatchState } from '../src/modules/game/plugins/draw-guess/state.js';
import { pickDrawGuessWord } from '../src/modules/game/plugins/draw-guess/words.js';
import { createMatchState as createGuessingMatchState } from '../src/modules/game/plugins/guessing-challenge/state.js';
import { createMatchState as createImposterMatchState } from '../src/modules/game/plugins/imposter-draw/state.js';
import { pickImposterDrawImage } from '../src/modules/game/plugins/imposter-draw/images.js';
import { pickFastAnswerQuestion } from '../src/modules/game/plugins/fast-answer/questions.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import {
  contentKeyFromText,
  pickWithLayeredHistory,
  pickWordWithAntiRepetition,
} from '../src/modules/game/runtime/content-selection.js';
import { onRoomDeleted } from '../src/modules/game/runtime/pregame-teams-room-hooks.js';
import {
  ROOM_CONTENT_HISTORY_KEY,
  ROOM_CONTENT_HISTORY_LIMIT,
  clearAllRoomContentHistoryForTests,
  getRoomContentHistory,
  recordRoomContentHistory,
} from '../src/modules/game/runtime/room-content-history.js';
import {
  clearRoomRoundCategory,
  setRoomRoundCategory,
} from '../src/modules/game/runtime/round-category-store.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  clearAllRoomContentHistoryForTests();
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

function makePlayers(count: number): GameShellPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `لاعب${index + 1}`,
    isConnected: true,
    isHost: index === 0,
    isReady: true,
  }));
}

function word(id: string, text: string, categoryId: string): GameContentWord {
  return { id, text, categoryId };
}

function syntheticBundle(words: GameContentWord[], categoryIds: string[]): GameContentBundle {
  return {
    gameId: 'test-game',
    categories: categoryIds.map((id) => ({ id, name: id, enabled: true })),
    words,
  };
}

const baraContent = registerGameContent(BARA_AL_SALAFA_GAME_ID);
const drawContent = registerGameContent(DRAW_GUESS_GAME_ID);
const imposterContent = registerGameContent(IMPOSTER_DRAW_GAME_ID);
const fastAnswerContent = registerGameContent('fast-answer');
registerGameContent('who-wrote-it');
registerGameContent('judge');
const guessingContent = registerGameContent(GUESSING_CHALLENGE_GAME_ID);

test('empty room history is safe and pick still works', () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  const picked = pickWithLayeredHistory({
    items,
    matchKeysOf: (item) => [item.id],
    roomKeyOf: (item) => item.id,
    matchUsedKeys: new Set(),
    roomRecentOldestFirst: [],
    randomIndex: () => 0,
  });
  assert.equal(picked?.id, 'a');
  assert.deepEqual(getRoomContentHistory('missing-room', ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA), []);
});

test('same match still avoids repeats', () => {
  const bundle = syntheticBundle(
    [
      word('a1', 'أسد', 'animals'),
      word('p1', 'شجرة', 'places'),
      word('a2', 'قط', 'animals'),
    ],
    ['animals', 'places'],
  );
  const first = pickWordWithAntiRepetition({
    bundle,
    usedWordTexts: [],
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: () => 0,
  });
  const second = pickWordWithAntiRepetition({
    bundle,
    usedWordTexts: [first!.text],
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: () => 0,
  });
  assert.ok(first && second);
  assert.notEqual(second.text, first.text);
});

test('new match in the same room avoids recently used content', () => {
  const roomId = 'room-same';
  const first = createDrawMatchState(roomId, makePlayers(3), drawContent.settings);
  const second = createDrawMatchState(roomId, makePlayers(3), drawContent.settings);
  assert.notEqual(second.round.word, first.round.word);
  assert.ok(
    getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS).includes(
      contentKeyFromText(first.round.word),
    ),
  );
});

test('new match in a different room is independent', () => {
  recordRoomContentHistory('room-a', ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS, 'alpha');
  recordRoomContentHistory('room-b', ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS, 'beta');
  assert.deepEqual(getRoomContentHistory('room-a', ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS), [
    'alpha',
  ]);
  assert.deepEqual(getRoomContentHistory('room-b', ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS), [
    'beta',
  ]);

  const fromB = pickWordWithAntiRepetition({
    bundle: syntheticBundle(
      [word('1', 'alpha', 'animals'), word('2', 'beta', 'animals')],
      ['animals'],
    ),
    lockedCategoryId: 'animals',
    roomId: 'room-b',
    historyKey: ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS,
    randomIndex: () => 0,
  });
  assert.equal(fromB?.text, 'alpha');
});

test('room history is bounded', () => {
  const roomId = 'room-bound';
  const limit = ROOM_CONTENT_HISTORY_LIMIT[ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA];
  for (let index = 1; index <= limit + 8; index += 1) {
    recordRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA, `item-${index}`);
  }
  const history = getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA);
  assert.equal(history.length, limit);
  assert.equal(history[0], 'item-9');
  assert.equal(history.at(-1), `item-${limit + 8}`);
  assert.equal(history.includes('item-1'), false);
});

test('oldest room history entries become eligible again on fallback', () => {
  const items = [{ id: 'old' }, { id: 'new' }];
  const picked = pickWithLayeredHistory({
    items,
    matchKeysOf: (item) => [item.id],
    roomKeyOf: (item) => item.id,
    matchUsedKeys: new Set(),
    roomRecentOldestFirst: ['old', 'new'],
    randomIndex: () => 0,
  });
  assert.equal(picked?.id, 'old');
});

test('fallback works when every eligible item is in room history', () => {
  const bundle = syntheticBundle(
    [word('1', 'واحد', 'animals'), word('2', 'اثنين', 'animals')],
    ['animals'],
  );
  const roomId = 'room-fallback';
  recordRoomContentHistory(
    roomId,
    ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    contentKeyFromText('واحد'),
  );
  recordRoomContentHistory(
    roomId,
    ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    contentKeyFromText('اثنين'),
  );
  const picked = pickWordWithAntiRepetition({
    bundle,
    lockedCategoryId: 'animals',
    usedWordTexts: [],
    roomId,
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: () => 0,
  });
  assert.equal(picked?.text, 'واحد');
});

test('room cleanup clears history', () => {
  const roomId = 'room-cleanup';
  recordRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA, 'kept-until-delete');
  recordRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS, 'shared-too');
  const io = { to: () => ({ emit: () => undefined }) };
  onRoomDeleted(io as never, roomId);
  assert.deepEqual(getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA), []);
  assert.deepEqual(getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS), []);
});

test('match teardown does not clear room history', () => {
  const roomId = 'room-abort';
  recordRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA, 'survive-abort');
  cleanupPluginMatchState(roomId, BARA_AL_SALAFA_GAME_ID);
  assert.deepEqual(getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA), [
    'survive-abort',
  ]);
});

test('Draw then Imposter share recent-content history', () => {
  const roomId = 'room-draw-then-imposter';
  const draw = createDrawMatchState(roomId, makePlayers(3), drawContent.settings);
  const imposter = createImposterMatchState(roomId, makePlayers(3), imposterContent.settings);
  assert.notEqual(imposter.round.imageLabel, draw.round.word);
  const shared = getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS);
  assert.ok(shared.includes(contentKeyFromText(draw.round.word)));
  assert.ok(shared.includes(contentKeyFromText(imposter.round.imageLabel)));
});

test('Imposter then Draw share recent-content history', () => {
  const roomId = 'room-imposter-then-draw';
  const imposter = createImposterMatchState(roomId, makePlayers(3), imposterContent.settings);
  const draw = createDrawMatchState(roomId, makePlayers(3), drawContent.settings);
  assert.notEqual(draw.round.word, imposter.round.imageLabel);
});

test('Bara and Guessing Challenge keep independent histories', () => {
  const roomId = 'room-bara-gc';
  createBaraMatchState(
    makePlayers(3),
    baraContent.bundle,
    baraContent.settings,
    undefined,
    roomId,
  );
  const baraBeforeGc = [...getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA)];
  createGuessingMatchState(roomId, makePlayers(2), guessingContent.settings);
  assert.deepEqual(
    getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA),
    baraBeforeGc,
  );
  assert.ok(
    getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.GUESSING_CHALLENGE).length >= 2,
  );
});

test('random Bara category selection is category-first', () => {
  const words = [
    ...Array.from({ length: 10 }, (_, index) => word(`a${index}`, `حيوان${index}`, 'animals')),
    ...Array.from({ length: 2 }, (_, index) => word(`p${index}`, `مكان${index}`, 'places')),
  ];
  const bundle = syntheticBundle(words, ['animals', 'places']);
  const categorySizes: number[] = [];
  pickWordWithAntiRepetition({
    bundle,
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: (exclusiveMax) => {
      categorySizes.push(exclusiveMax);
      return 0;
    },
  });
  assert.equal(categorySizes[0], 2);
  assert.notEqual(categorySizes[0], words.length);

  const counts = { animals: 0, places: 0 };
  for (let index = 0; index < 200; index += 1) {
    const picked = pickWordWithAntiRepetition({
      bundle,
      historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    });
    assert.ok(picked);
    counts[picked.categoryId as 'animals' | 'places'] += 1;
  }
  const animalShare = counts.animals / 200;
  assert.ok(animalShare > 0.35 && animalShare < 0.65, `animals share ${animalShare}`);
});

test('random Draw category selection is category-first', () => {
  const sizes: number[] = [];
  pickWordWithAntiRepetition({
    bundle: drawContent.bundle,
    enabledCategoryIds: drawContent.settings.enabledCategories,
    historyKey: ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS,
    randomIndex: (exclusiveMax) => {
      sizes.push(exclusiveMax);
      return 0;
    },
  });
  const enabledCount = drawContent.bundle.categories.filter((category) => category.enabled).length;
  assert.equal(sizes[0], enabledCount);
  assert.notEqual(sizes[0], drawContent.bundle.words.length);
});

test('random Imposter category selection is category-first', () => {
  const sizes: number[] = [];
  pickWordWithAntiRepetition({
    bundle: imposterContent.bundle,
    enabledCategoryIds: imposterContent.settings.enabledCategories,
    historyKey: ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS,
    randomIndex: (exclusiveMax) => {
      sizes.push(exclusiveMax);
      return 0;
    },
  });
  const enabledCount = imposterContent.bundle.categories.filter((category) => category.enabled)
    .length;
  assert.equal(sizes[0], enabledCount);
  assert.notEqual(sizes[0], imposterContent.bundle.words.length);
});

test('locked category is respected and not randomized', () => {
  const words = [
    ...Array.from({ length: 8 }, (_, index) => word(`a${index}`, `حيوان${index}`, 'animals')),
    ...Array.from({ length: 8 }, (_, index) => word(`p${index}`, `مكان${index}`, 'places')),
  ];
  const bundle = syntheticBundle(words, ['animals', 'places']);
  const sizes: number[] = [];
  const picked = pickWordWithAntiRepetition({
    bundle,
    enabledCategoryIds: ['places'],
    lockedCategoryId: 'places',
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: (exclusiveMax) => {
      sizes.push(exclusiveMax);
      return 0;
    },
  });
  assert.equal(picked?.categoryId, 'places');
  assert.equal(sizes.length, 1);
  assert.equal(sizes[0], 8);

  const roomId = 'room-locked-draw';
  setRoomRoundCategory(roomId, 'animals');
  for (let index = 0; index < 8; index += 1) {
    const wordEntry = pickDrawGuessWord(roomId, []);
    assert.equal(wordEntry.categoryId, 'animals');
  }
  clearRoomRoundCategory(roomId);

  setRoomRoundCategory(roomId, 'food');
  const image = pickImposterDrawImage(roomId, []);
  assert.equal(image.categoryId, 'food');
  clearRoomRoundCategory(roomId);
});

test('random mode skips a fully room-recent category when another has room-fresh items', () => {
  const bundle = syntheticBundle(
    [
      word('a1', 'أسد', 'animals'),
      word('a2', 'قط', 'animals'),
      word('p1', 'شجرة', 'places'),
      word('p2', 'جبل', 'places'),
    ],
    ['animals', 'places'],
  );
  const roomId = 'room-cat-cooldown';
  recordRoomContentHistory(
    roomId,
    ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    contentKeyFromText('أسد'),
  );
  recordRoomContentHistory(
    roomId,
    ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    contentKeyFromText('قط'),
  );

  for (let index = 0; index < 20; index += 1) {
    const picked = pickWordWithAntiRepetition({
      bundle,
      roomId,
      historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
      historyLimit: ROOM_CONTENT_HISTORY_LIMIT[ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA],
    });
    assert.equal(picked?.categoryId, 'places');
    clearAllRoomContentHistoryForTests();
    recordRoomContentHistory(
      roomId,
      ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
      contentKeyFromText('أسد'),
    );
    recordRoomContentHistory(
      roomId,
      ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
      contentKeyFromText('قط'),
    );
  }
});

test('random mode still succeeds when every category is room-recent', () => {
  const bundle = syntheticBundle(
    [
      word('a1', 'أسد', 'animals'),
      word('p1', 'شجرة', 'places'),
    ],
    ['animals', 'places'],
  );
  const roomId = 'room-all-recent';
  recordRoomContentHistory(
    roomId,
    ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    contentKeyFromText('أسد'),
  );
  recordRoomContentHistory(
    roomId,
    ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    contentKeyFromText('شجرة'),
  );
  const picked = pickWordWithAntiRepetition({
    bundle,
    roomId,
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: () => 0,
  });
  assert.ok(picked);
  assert.equal(picked.text, 'أسد');
});

test('unused match category is still preferred when both have room-fresh items', () => {
  const bundle = syntheticBundle(
    [
      word('a1', 'أسد', 'animals'),
      word('a2', 'قط', 'animals'),
      word('p1', 'شجرة', 'places'),
      word('p2', 'جبل', 'places'),
    ],
    ['animals', 'places'],
  );
  const picked = pickWordWithAntiRepetition({
    bundle,
    usedWordTexts: ['أسد'],
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: () => 0,
  });
  assert.equal(picked?.categoryId, 'places');
});

test('Draw & Guess random mode uses shared drawable room history for category eligibility', () => {
  const roomId = 'room-draw-cat-fresh';
  for (const entry of drawContent.bundle.words.filter((item) => item.categoryId === 'animals')) {
    recordRoomContentHistory(
      roomId,
      ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS,
      contentKeyFromText(entry.text),
    );
  }
  const picked = pickDrawGuessWord(roomId, []);
  assert.notEqual(picked.categoryId, 'animals');
});

test('Imposter Draw random mode uses the same shared drawable room history', () => {
  const roomId = 'room-imposter-cat-fresh';
  for (const entry of imposterContent.bundle.words.filter((item) => item.categoryId === 'animals')) {
    recordRoomContentHistory(
      roomId,
      ROOM_CONTENT_HISTORY_KEY.DRAWABLE_WORDS,
      contentKeyFromText(entry.text),
    );
  }
  const picked = pickImposterDrawImage(roomId, []);
  assert.notEqual(picked.categoryId, 'animals');
});

test('locked category still picks from that category even when it is room-recent', () => {
  const bundle = syntheticBundle(
    [
      word('a1', 'أسد', 'animals'),
      word('p1', 'شجرة', 'places'),
    ],
    ['animals', 'places'],
  );
  const roomId = 'room-locked-recent';
  recordRoomContentHistory(
    roomId,
    ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    contentKeyFromText('أسد'),
  );
  const picked = pickWordWithAntiRepetition({
    bundle,
    lockedCategoryId: 'animals',
    roomId,
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: () => 0,
  });
  assert.equal(picked?.categoryId, 'animals');
  assert.equal(picked?.text, 'أسد');
});

test('same canonical text across categories cannot be selected twice in one match', () => {
  const bundle = syntheticBundle(
    [
      word('series-1', 'The Last of Us', 'series'),
      word('games-1', 'The Last of Us', 'games'),
      word('series-2', 'Other Show', 'series'),
      word('games-2', 'Other Game', 'games'),
    ],
    ['series', 'games'],
  );
  const second = pickWordWithAntiRepetition({
    bundle,
    usedWordTexts: ['The Last of Us'],
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: () => 0,
  });
  assert.ok(second);
  assert.notEqual(normalizeCanonicalEntryKey(second.text), normalizeCanonicalEntryKey('The Last of Us'));

  const arabic = syntheticBundle(
    [
      word('t1', 'السيارة', 'tech'),
      word('p1', 'سيارة', 'places'),
      word('t2', 'هاتف', 'tech'),
    ],
    ['tech', 'places'],
  );
  const afterArticle = pickWordWithAntiRepetition({
    bundle: arabic,
    usedWordTexts: ['السيارة'],
    historyKey: ROOM_CONTENT_HISTORY_KEY.BARA_AL_SALAFA,
    randomIndex: () => 0,
  });
  assert.equal(afterArticle?.text, 'هاتف');
});

test('Fast Answer rematch in the same room avoids recent question ids', () => {
  const roomId = 'room-fa';
  const categoryId = (fastAnswerContent.bundle.questions ?? [])[0]?.categoryId;
  assert.ok(categoryId);
  const first = pickFastAnswerQuestion(categoryId, [], roomId);
  const second = pickFastAnswerQuestion(categoryId, [], roomId);
  if ((fastAnswerContent.bundle.questions ?? []).filter((question) => question.categoryId === categoryId).length > 1) {
    assert.notEqual(second.id, first.id);
  }
  assert.ok(
    getRoomContentHistory(roomId, ROOM_CONTENT_HISTORY_KEY.FAST_ANSWER).includes(first.id),
  );
});

test('Timing Challenge has no content-history namespace', () => {
  assert.equal(
    Object.values(ROOM_CONTENT_HISTORY_KEY).includes('timing-challenge' as never),
    false,
  );
});

test('cleanup hook is room-delete, not match-teardown', () => {
  const hooks = readFileSync(join(root, 'src/modules/game/runtime/pregame-teams-room-hooks.ts'), 'utf8');
  const cleanup = readFileSync(join(root, 'src/modules/game/runtime/cleanup-plugin-match.ts'), 'utf8');
  assert.match(hooks, /clearRoomContentHistory\(roomId\)/);
  assert.doesNotMatch(cleanup, /clearRoomContentHistory/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
