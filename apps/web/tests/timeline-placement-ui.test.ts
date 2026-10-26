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

test('lobby shows authoritative settings to all and gates editing on server view', () => {
  const source = read('components/lobby/timeline-placement-lobby-panel.tsx');
  assert.match(source, /TIMELINE_PLACEMENT_ROUND_OPTIONS/);
  assert.match(source, /TIMELINE_PLACEMENT_SELECTION_OPTIONS/);
  assert.match(source, /view\.canEditSettings && !isActiveMatch/);
  assert.match(source, /ضع كل حدث بين حدثين معروفين/);
  assert.match(source, /جاهزون الآن:/);
  assert.doesNotMatch(source, /isAdmin:\s*true|premium:\s*true|userId:/);
});

test('timeline is mobile-scrollable with large gap controls and read-only spectator state', () => {
  const source = read('plugins/timeline-placement/game-screen.tsx');
  assert.match(source, /max-h-\[62dvh\]/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /dir="ltr"/);
  assert.match(source, /dir="rtl"/);
  assert.match(source, /min-h-12 w-full/);
  assert.match(source, /view\.isSpectator/);
  assert.match(source, /لا يمكنك اختيار موقع حدث/);
  assert.match(source, /aria-pressed=\{props\.selected\}/);
});

test('player names render before answer and answer reveal has ten-second progress strip', () => {
  const source = read('plugins/timeline-placement/game-screen.tsx');
  const progressSource = read('components/game/deadline-progress.tsx');
  const placementIndex = source.indexOf("view.phase === 'placements-reveal'");
  const answerIndex = source.indexOf("view.phase === 'answer-reveal' && view.revealedAnswer");
  assert.ok(placementIndex >= 0);
  assert.ok(answerIndex > placementIndex);
  assert.match(source, /السنة والموقع الصحيح ما زالا مخفيين/);
  assert.match(source, /TIMELINE_PLACEMENT_ANSWER_REVEAL_MS/);
  assert.match(source, /<DeadlineProgress/);
  assert.match(source, /totalDurationSeconds=\{TIMELINE_PLACEMENT_ANSWER_REVEAL_MS \/ 1000\}/);
  assert.match(progressSource, /transition-\[width\]/);
  assert.match(source, /view\.canAdvance/);
});

test('game is lazy registered and uses the shared room experience shell', () => {
  const plugin = read('plugins/timeline-placement/index.tsx');
  const layer = read('components/game-plugins/game-plugin-layer.tsx');
  assert.match(plugin, /lazyGameScreen/);
  assert.match(plugin, /import\('\.\/game-screen'\)/);
  assert.match(layer, /TIMELINE_PLACEMENT_GAME_ID/);
  assert.match(
    layer,
    /<GameExperienceShell gameId=\{state\.gameId\}>\{pluginContent\}<\/GameExperienceShell>/,
  );
});

test('Timeline Placement remains absent from all public discovery paths', () => {
  for (const path of [
    'lib/lobby/mock-games.ts',
    'lib/public/game-catalog.ts',
    'lib/public/game-seo-content.ts',
    'components/public/public-navbar.tsx',
    'components/home/home-navbar.tsx',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /timeline-placement|زمانها وين/);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
