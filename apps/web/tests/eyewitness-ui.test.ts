import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
let passed = 0;
let failed = 0;

function test(name: string, run: () => void) {
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

test('lobby exposes four authoritative provisional settings to everyone', () => {
  const source = read('components/lobby/eyewitness-lobby-panel.tsx');
  assert.match(source, /EYEWITNESS_ROUND_OPTIONS/);
  assert.match(source, /EYEWITNESS_DESCRIPTION_SECONDS_OPTIONS/);
  assert.match(source, /EYEWITNESS_DRAWING_SECONDS_OPTIONS/);
  assert.match(source, /EYEWITNESS_VOTING_SECONDS_OPTIONS/);
  assert.match(source, /view\.canEditSettings/);
});

test('witness view supports mobile zoom, optional description, autosave and explicit locking', () => {
  const source = read('plugins/eyewitness/game-screen.tsx');
  assert.match(source, /type="range"/);
  assert.match(source, /touch-pan-x touch-pan-y/);
  assert.match(source, /maxLength=\{600\}/);
  assert.match(source, /إرسال الوصف/);
  assert.match(source, /saveDescriptionRef/);
});

test('drawing reuses bounded canvas tools and requires confirmed clear and explicit submit', () => {
  const source = read('plugins/eyewitness/game-screen.tsx');
  assert.match(source, /DrawingCanvas/);
  assert.match(source, /DrawingToolbar/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /تسليم الرسمة/);
});

test('voting is anonymous, blocks own card, enlarges artwork and requires confirmation', () => {
  const source = read('plugins/eyewitness/game-screen.tsx');
  assert.match(source, /anonymousArtworks/);
  assert.match(source, /ownArtworkId/);
  assert.match(source, /ArtworkModal/);
  assert.match(source, /تأكيد التصويت/);
  assert.match(source, /الأسماء والنتائج مخفية/);
});

test('plugin is lazy loaded and integrated without public discovery', () => {
  const plugin = read('plugins/eyewitness/index.tsx');
  const bootstrap = read('plugins/index.ts');
  const layer = read('components/game-plugins/game-plugin-layer.tsx');
  const publicCatalog = read('lib/public/game-catalog.ts');
  const lobbyGames = read('lib/lobby/mock-games.ts');
  assert.match(plugin, /lazyGameScreen/);
  assert.match(bootstrap, /eyewitnessClientPlugin/);
  assert.match(layer, /EYEWITNESS_GAME_ID/);
  assert.doesNotMatch(publicCatalog, /eyewitness|شاهد عيان/);
  assert.doesNotMatch(lobbyGames, /eyewitness|شاهد عيان/);
});

console.log(`\nEyewitness UI tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
