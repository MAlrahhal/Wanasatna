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

test('lobby exposes both modes and hides the writer timer in server mode', () => {
  const source = read('components/lobby/emoji-language-lobby-panel.tsx');
  assert.match(source, /لاعب يشرح/);
  assert.match(source, /لغز جاهز/);
  assert.match(source, /view\.settings\.mode === 'player-clue'/);
  assert.match(source, /EMOJI_LANGUAGE_PREPARATION_OPTIONS/);
  assert.match(source, /EMOJI_LANGUAGE_GUESSING_OPTIONS/);
  assert.match(source, /view\.canEditSettings && !isActiveMatch/);
});

test('writer uses only the curated on-site picker with ordered removal and 10-token cap', () => {
  const source = read('plugins/emoji-language/game-screen.tsx');
  assert.match(source, /EMOJI_LANGUAGE_PICKER\.map/);
  assert.match(source, /selectedEmojis\.length < 10/);
  assert.match(source, /filter\(\(_, candidate\) => candidate !== index\)/);
  assert.match(source, /اعتماد التلميح نهائيًا/);
  assert.match(source, /aria-label="لوحة إيموجي اللعبة"/);
});

test('private answer renders only in writer branches while spectators get read-only state', () => {
  const source = read('plugins/emoji-language/game-screen.tsx');
  assert.match(source, /view\.canSubmitClue \?/);
  assert.match(source, /answer=\{view\.privateAnswer \?\? ''\}/);
  assert.match(source, /view\.isWriter \?/);
  assert.match(source, /view\.isSpectator \?/);
  assert.match(source, /لا يمكنك إرسال رمز أو تخمين/);
  assert.doesNotMatch(source, /acceptedAnswers|answerKey|playerId:/);
});

test('game is lazy registered and uses the shared themed room experience', () => {
  const plugin = read('plugins/emoji-language/index.tsx');
  const layer = read('components/game-plugins/game-plugin-layer.tsx');
  assert.match(plugin, /lazyGameScreen/);
  assert.match(plugin, /import\('\.\/game-screen'\)/);
  assert.match(layer, /EMOJI_LANGUAGE_GAME_ID/);
  assert.match(layer, /<GameExperienceShell>\{pluginContent\}<\/GameExperienceShell>/);
});

test('Emoji Language remains absent from all public discovery catalogs', () => {
  for (const path of [
    'lib/lobby/mock-games.ts',
    'lib/public/game-catalog.ts',
    'lib/public/game-seo-content.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /emoji-language|لغة الإيموجي/);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
