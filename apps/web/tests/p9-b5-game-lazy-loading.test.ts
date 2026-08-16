/**
 * P9-B.5: each game GameScreen is a lazy/dynamic entry, not an eager static import.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '@/plugins';
import { getClientGamePlugin, listClientGamePlugins } from '@/lib/game-plugins/registry';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const GAMES = [
  { id: 'bara-al-salafa', dir: 'bara-al-salafa', exportName: 'BaraAlSalafaGameScreen' },
  { id: 'draw-guess', dir: 'draw-guess', exportName: 'DrawGuessGameScreen' },
  { id: 'imposter-draw', dir: 'imposter-draw', exportName: 'ImposterDrawGameScreen' },
  { id: 'timing-challenge', dir: 'timing-challenge', exportName: 'TimingChallengeGameScreen' },
  { id: 'fast-answer', dir: 'fast-answer', exportName: 'FastAnswerGameScreen' },
  { id: 'who-wrote-it', dir: 'who-wrote-it', exportName: 'WhoWroteItGameScreen' },
  { id: 'judge', dir: 'judge', exportName: 'JudgeGameScreen' },
  { id: 'guessing-challenge', dir: 'guessing-challenge', exportName: 'GuessingChallengeGameScreen' },
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

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('all 8 games resolve from the client registry', () => {
  const ids = listClientGamePlugins().map((plugin) => plugin.metadata.id).sort();
  assert.deepEqual(
    ids,
    [...GAMES.map((game) => game.id)].sort(),
  );
  for (const game of GAMES) {
    const plugin = getClientGamePlugin(game.id);
    assert.ok(plugin, `${game.id} must resolve`);
    assert.equal(plugin.metadata.id, game.id);
    assert.equal(typeof plugin.GameScreen, 'function');
  }
});

test('each plugin entry lazy-loads GameScreen instead of statically importing it', () => {
  for (const game of GAMES) {
    const index = read(`plugins/${game.dir}/index.tsx`);
    assert.match(index, /lazyGameScreen/);
    assert.match(index, /import\('\.\/game-screen'\)/);
    assert.match(index, new RegExp(`mod\\.${game.exportName}`));
    assert.doesNotMatch(index, /from ['"]\.\/game-screen['"]/);
  }
});

test('bootstrap does not statically import game-screen modules', () => {
  const bootstrap = read('plugins/index.ts');
  assert.doesNotMatch(bootstrap, /game-screen/);
  assert.match(bootstrap, /registerAllClientGamePlugins/);
});

test('renderer remounts per gameId and shows existing loading/error UI', () => {
  const renderer = read('components/game-plugins/game-plugin-renderer.tsx');
  const lazy = read('lib/game-plugins/lazy-game-screen.tsx');
  assert.match(renderer, /GameScreenChunkErrorBoundary key=\{gameId\}/);
  assert.match(lazy, /next\/dynamic/);
  assert.match(lazy, /ssr:\s*false/);
  assert.match(lazy, /GameSystemLoading/);
  assert.match(lazy, /GameSystemError/);
  assert.match(lazy, /SYSTEM_COPY\.unexpectedError/);
});

test('Guessing Challenge Real3D stays a nested dynamic import', () => {
  const gameplay = read('plugins/guessing-challenge/gameplay-scene.tsx');
  const index = read('plugins/guessing-challenge/index.tsx');
  assert.match(gameplay, /next\/dynamic/);
  assert.match(gameplay, /import\('\.\/real3d\/real3d-scene'\)/);
  assert.doesNotMatch(index, /real3d/);
  assert.doesNotMatch(index, /three|@react-three/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
