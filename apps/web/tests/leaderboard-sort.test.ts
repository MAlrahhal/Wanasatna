/**
 * Unit tests for Bara leaderboard sorting helpers.
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/leaderboard-sort.test.ts
 */
import assert from 'node:assert/strict';
import {
  compareByRoundPointsThenName,
  compareByScoreThenName,
  competitionDisplayRanks,
  isArabicScriptName,
} from '../lib/game/leaderboard-sort';

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

function sortByScore(
  entries: Array<{ score: number; name: string; playerId?: string }>,
): string[] {
  return [...entries]
    .sort((left, right) => compareByScoreThenName(left, right))
    .map((entry) => entry.name);
}

function sortByRoundPoints(
  entries: Array<{ roundPoints: number; name: string; playerId?: string }>,
): string[] {
  return [...entries]
    .sort((left, right) => compareByRoundPointsThenName(left, right))
    .map((entry) => entry.name);
}

test('A higher total score sorts first', () => {
  assert.deepEqual(
    sortByScore([
      { score: 100, name: 'محمد' },
      { score: 300, name: 'خالد' },
      { score: 200, name: 'سارة' },
    ]),
    ['خالد', 'سارة', 'محمد'],
  );
});

test('B equal score: Arabic before English', () => {
  assert.deepEqual(
    sortByScore([
      { score: 100, name: 'Zaid' },
      { score: 100, name: 'أحمد' },
      { score: 100, name: 'Sara' },
    ]),
    ['أحمد', 'Sara', 'Zaid'],
  );
});

test('C equal score Arabic names: Arabic alphabetical order', () => {
  assert.deepEqual(
    sortByScore([
      { score: 200, name: 'محمد' },
      { score: 200, name: 'أحمد' },
      { score: 200, name: 'خالد' },
    ]),
    ['أحمد', 'خالد', 'محمد'],
  );
});

test('D equal score English names: alphabetical order', () => {
  assert.deepEqual(
    sortByScore([
      { score: 50, name: 'Zaid' },
      { score: 50, name: 'Adam' },
      { score: 50, name: 'John' },
    ]),
    ['Adam', 'John', 'Zaid'],
  );
});

test('E zero-score players remain visible in sort order', () => {
  assert.deepEqual(
    sortByScore([
      { score: 0, name: 'Zaid' },
      { score: 100, name: 'محمد' },
      { score: 0, name: 'سارة' },
    ]),
    ['محمد', 'سارة', 'Zaid'],
  );
});

test('F round-points list: higher round score first', () => {
  assert.deepEqual(
    sortByRoundPoints([
      { roundPoints: 0, name: 'سارة' },
      { roundPoints: 100, name: 'محمد' },
      { roundPoints: 50, name: 'خالد' },
    ]),
    ['محمد', 'خالد', 'سارة'],
  );
});

test('G round-points ties: Arabic alphabetical fallback', () => {
  assert.deepEqual(
    sortByRoundPoints([
      { roundPoints: 100, name: 'محمد' },
      { roundPoints: 100, name: 'أحمد' },
      { roundPoints: 100, name: 'Zaid' },
    ]),
    ['أحمد', 'محمد', 'Zaid'],
  );
});

test('script detection: Arabic vs Latin names', () => {
  assert.equal(isArabicScriptName('محمد'), true);
  assert.equal(isArabicScriptName('Sara'), false);
  assert.equal(isArabicScriptName('Ali'), false);
});

test('competition ranks: hide when all scores equal', () => {
  assert.deepEqual(competitionDisplayRanks([0, 0, 0]), [null, null, null]);
});

test('competition ranks: ties share rank without fake index order', () => {
  assert.deepEqual(competitionDisplayRanks([100, 100, 50]), [1, 1, 3]);
  assert.deepEqual(competitionDisplayRanks([200, 100, 100]), [1, 2, 2]);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
