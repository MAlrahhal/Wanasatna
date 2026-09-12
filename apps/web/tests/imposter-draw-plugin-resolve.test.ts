import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAllClientGamePlugins } from '@/plugins';
import { getClientGamePlugin } from '@/lib/game-plugins/registry';
import { IMPOSTER_DRAW_GAME_ID } from '@wanasatna/shared';
import { ImposterDrawGameScreen } from '@/plugins/imposter-draw/game-screen';
import { imposterDrawClientPlugin } from '@/plugins/imposter-draw';

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

test('shared game id is imposter-draw', () => {
  assert.equal(IMPOSTER_DRAW_GAME_ID, 'imposter-draw');
});

test('client plugin metadata id matches shared constant', () => {
  assert.equal(imposterDrawClientPlugin.metadata.id, IMPOSTER_DRAW_GAME_ID);
});

test('GameScreen export is a renderable function', () => {
  assert.equal(typeof ImposterDrawGameScreen, 'function');
  assert.equal(typeof imposterDrawClientPlugin.GameScreen, 'function');
});

test('registry resolves imposter-draw to a lazy GameScreen entry', () => {
  registerAllClientGamePlugins();
  const plugin = getClientGamePlugin(IMPOSTER_DRAW_GAME_ID);
  assert.ok(plugin, 'plugin must resolve');
  assert.equal(plugin.metadata.id, IMPOSTER_DRAW_GAME_ID);
  assert.equal(typeof plugin.GameScreen, 'function');
});

test('spectator voting mounts read-only VotingScreen instead of a countdown stub', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins/imposter-draw/game-screen.tsx'), 'utf8');
  assert.match(source, /isSpectator=\{isSpectator\}/);
  assert.match(source, /questionHelper=\{isSpectator \? 'اللاعبون يصوّتون الآن'/);
  assert.doesNotMatch(source, /if \(view\.isMatchSpectator\) \{[\s\S]*phaseLabel="مشاهدة"/);
  const waiting = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins/draw-guess/waiting-spectator-screen.tsx'),
    'utf8',
  );
  assert.doesNotMatch(waiting, /secretWord/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
