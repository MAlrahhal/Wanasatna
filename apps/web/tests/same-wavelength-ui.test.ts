import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
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

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('lobby exposes both authoritative modes and self-service team assignments', () => {
  const lobby = read('components/lobby/same-wavelength-lobby-panel.tsx');
  assert.match(lobby, /فردي · 5 جولات/);
  assert.match(lobby, /فرق · 3 جولات كاملة/);
  assert.match(lobby, /SAME_WAVELENGTH_UPDATE_SETTINGS_EVENT/);
  assert.match(lobby, /SAME_WAVELENGTH_ASSIGN_EVENT/);
  assert.match(lobby, /\{ team, role \}/);
  assert.doesNotMatch(lobby, /isAdmin:\s*true|userId:|premium:\s*true/);
});

test('game UI keeps proposing and confirming as separate actions and preserves zero', () => {
  const game = read('plugins/same-wavelength/game-screen.tsx');
  assert.match(game, /min=\{0\}/);
  assert.match(game, /max=\{100\}/);
  assert.match(game, /position !== null && void props\.propose\(position\)/);
  assert.match(game, /onClick=\{\(\) => void props\.confirm\(\)\}/);
  assert.match(game, /dir="ltr"/);
  assert.match(game, /يمكنك متابعة الطيف والتلميح والنتائج، لكن لا يمكنك إرسال علامة/);
});

test('private target is rendered only from the server role-scoped field', () => {
  const game = read('plugins/same-wavelength/game-screen.tsx');
  const hook = read('plugins/same-wavelength/use-player-view.ts');
  assert.match(game, /view\.privateTarget/);
  assert.match(game, /view\.revealedTarget/);
  assert.doesNotMatch(game, /Math\.random|target\s*=\s*position/);
  assert.match(hook, /AckGenerationGate/);
  assert.match(hook, /runLatestAck/);
  assert.match(hook, /bindPluginViewResync/);
});

test('game is registered lazily but absent from every public discovery source', () => {
  const plugin = read('plugins/same-wavelength/index.tsx');
  const bootstrap = read('plugins/index.ts');
  assert.match(plugin, /lazyGameScreen/);
  assert.match(plugin, /import\('\.\/game-screen'\)/);
  assert.match(bootstrap, /sameWavelengthClientPlugin/);
  for (const path of [
    'lib/public/game-catalog.ts',
    'lib/lobby/mock-games.ts',
    'components/public/game-cards.tsx',
    'components/public/public-navbar.tsx',
  ]) {
    assert.doesNotMatch(read(path), /same-wavelength|على نفس الموجة/, path);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
