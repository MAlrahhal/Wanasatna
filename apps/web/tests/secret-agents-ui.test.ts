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

test('lobby exposes unassigned/red/blue roles and independent timer controls', () => {
  const source = read('components/lobby/secret-agents-lobby-panel.tsx');
  assert.match(source, /غير معيّنين/);
  assert.match(source, /الفريق الأحمر/);
  assert.match(source, /الفريق الأزرق/);
  assert.match(source, /spymaster/);
  assert.match(source, /operative/);
  assert.match(source, /clueTimerEnabled/);
  assert.match(source, /operativeTimerEnabled/);
  assert.match(source, /correctGuessBonusSeconds/);
});

test('mobile board is fixed 5 columns with separate nomination and confirm controls', () => {
  const source = read('plugins/secret-agents/game-screen.tsx');
  assert.match(source, /grid-cols-5/);
  assert.match(source, /toggleNomination\(card\.id\)/);
  assert.match(source, /confirmCard\(card\.id\)/);
  assert.match(source, /aria-label={`تأكيد \$\{card\.word\} كإجابة نهائية`}/);
  assert.match(source, /تأكيد ✓/);
  assert.match(source, /زر «تأكيد ✓» إجراء نهائي منفصل/);
  assert.match(source, /bottom-1/);
});

test('secret key is rendered only from the private player view', () => {
  const screen = read('plugins/secret-agents/game-screen.tsx');
  const hook = read('plugins/secret-agents/use-player-view.ts');
  assert.match(screen, /view\.selfAssignment\?\.role === 'spymaster' && view\.secretKey/);
  assert.match(screen, /const privateType = view\.secretKey\?\.\[card\.id\]/);
  assert.match(hook, /SECRET_AGENTS_SYNC_EVENT/);
  assert.doesNotMatch(screen, /startingTeam.*secretKey|premium.*secretKey/i);
});

test('closed-test game uses the shared themed and ad-policy game shell', () => {
  const layer = read('components/game-plugins/game-plugin-layer.tsx');
  assert.match(layer, /SECRET_AGENTS_GAME_ID/);
  assert.match(layer, /gameId === SECRET_AGENTS_GAME_ID/);
  assert.match(
    layer,
    /<GameExperienceShell gameId=\{state\.gameId\}>\{pluginContent\}<\/GameExperienceShell>/,
  );
});

test('game remains absent from public and ordinary lobby catalogs', () => {
  for (const path of [
    'lib/lobby/mock-games.ts',
    'lib/public/game-catalog.ts',
    'lib/public/game-seo-content.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /secret-agents|العملاء السريون/);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
