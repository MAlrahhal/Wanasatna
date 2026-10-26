import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
let passed = 0;
let failed = 0;
function test(name: string, run: () => void): void {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

test('lobby explains the cooperative flow and uses the server edit permission', () => {
  const source = read('components/lobby/one-word-only-lobby-panel.tsx');
  assert.match(source, /ONE_WORD_ONLY_ROUND_OPTIONS/);
  assert.match(source, /ONE_WORD_ONLY_CLUE_SECONDS_OPTIONS/);
  assert.match(source, /ONE_WORD_ONLY_GUESS_SECONDS_OPTIONS/);
  assert.match(source, /view\.canEditSettings && !isActiveMatch/);
  assert.match(source, /تحدٍ تعاوني بكلمة واحدة/);
  assert.match(source, /جاهزون الآن:/);
  assert.doesNotMatch(source, /isAdmin:\s*true|premium:\s*true|userId:/);
});

test('mobile guessing requires a separate selection and confirmation action', () => {
  const source = read('plugins/one-word-only/game-screen.tsx');
  assert.match(source, /grid grid-cols-2 gap-2 lg:grid-cols-4/);
  assert.match(source, /min-h-16/);
  assert.match(source, /aria-pressed=\{props\.selectedOptionId === option\.id\}/);
  assert.match(source, /تأكيد الإجابة/);
  assert.match(source, /onClick=\{\(\) => props\.setSelectedOptionId\(option\.id\)\}/);
  assert.match(source, /disabled=\{!props\.selectedOptionId \|\| props\.disabled\}/);
  assert.match(source, /onClick=\{props\.onConfirm\}/);
});

test('role, secrecy, reconnect wait, duplicate colors, and cooperative result have explicit UI', () => {
  const source = read('plugins/one-word-only/game-screen.tsx');
  assert.match(source, /أنت المخمّن/);
  assert.match(source, /view\.privateAnswer/);
  assert.match(source, /view\.waitingForGuesser/);
  assert.match(source, /border-emerald-300/);
  assert.match(source, /border-red-300/);
  assert.match(source, /لا توجد نقاط فردية أو فائز/);
  assert.match(source, /<DeadlineProgress/);
});

test('game is lazy registered through the shared shell and absent from public discovery', () => {
  const plugin = read('plugins/one-word-only/index.tsx');
  const layer = read('components/game-plugins/game-plugin-layer.tsx');
  assert.match(plugin, /lazyGameScreen/);
  assert.match(layer, /ONE_WORD_ONLY_GAME_ID/);
  for (const path of [
    'lib/lobby/mock-games.ts',
    'lib/public/game-catalog.ts',
    'lib/public/game-seo-content.ts',
    'components/public/public-navbar.tsx',
    'components/home/home-navbar.tsx',
  ]) {
    assert.doesNotMatch(read(path), /one-word-only|كلمة وحدة بس/);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
