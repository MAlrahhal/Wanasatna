/**
 * P10-B.3 web contracts: /dev production gate + answer maxLength.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldBlockDevRoutes } from '../lib/dev/dev-routes';

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

test('production /dev/* is blocked; development remains open', () => {
  assert.equal(shouldBlockDevRoutes('production'), true);
  assert.equal(shouldBlockDevRoutes('development'), false);
  assert.equal(shouldBlockDevRoutes('test'), false);

  const layout = read('app/dev/layout.tsx');
  assert.match(layout, /shouldBlockDevRoutes/);
  assert.match(layout, /notFound\(\)/);
  assert.doesNotMatch(layout, /NEXT_PUBLIC_/);

  const home = read('app/(public)/home-page-client.tsx');
  assert.doesNotMatch(home, /shouldBlockDevRoutes/);
});

test('Draw Guess and Fast Answer inputs cap at MAX_GAME_ANSWER_LENGTH', () => {
  const guess = read('plugins/draw-guess/guess-panel.tsx');
  const fast = read('plugins/fast-answer/question-screen.tsx');
  assert.match(guess, /MAX_GAME_ANSWER_LENGTH/);
  assert.match(guess, /maxLength=\{MAX_GAME_ANSWER_LENGTH\}/);
  assert.match(fast, /MAX_GAME_ANSWER_LENGTH/);
  assert.match(fast, /maxLength=\{MAX_GAME_ANSWER_LENGTH\}/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
