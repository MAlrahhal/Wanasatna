import assert from 'node:assert/strict';
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
  assert.equal(imposterDrawClientPlugin.GameScreen, ImposterDrawGameScreen);
});

test('registry resolves imposter-draw to the same GameScreen', () => {
  registerAllClientGamePlugins();
  const plugin = getClientGamePlugin(IMPOSTER_DRAW_GAME_ID);
  assert.ok(plugin, 'plugin must resolve');
  assert.equal(plugin.GameScreen, ImposterDrawGameScreen);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
