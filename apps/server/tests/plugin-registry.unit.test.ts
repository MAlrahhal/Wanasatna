/**
 * Server plugin registry sanity for production game IDs.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/plugin-registry.unit.test.ts
 */
import assert from 'node:assert/strict';
import { TIMING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { registerAllGameContent } from '../src/modules/content/index.js';
import { registerAllGamePlugins } from '../src/modules/game/plugins/index.js';
import {
  getGamePluginDefinition,
  hasGamePlugin,
  listRegisteredGames,
  registerGameDefinition,
} from '../src/modules/game/runtime/plugin-registry.js';

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

registerAllGameContent();
registerAllGamePlugins();

test('timing-challenge resolves in server registry', () => {
  assert.equal(hasGamePlugin(TIMING_CHALLENGE_GAME_ID), true);
  const plugin = getGamePluginDefinition(TIMING_CHALLENGE_GAME_ID);
  assert.ok(plugin);
  assert.equal(plugin.id, 'timing-challenge');
  assert.equal(plugin.minPlayers, 2);
});

test('lobby/plugin canonical IDs include production games', () => {
  const ids = listRegisteredGames()
    .map(({ gameId }) => gameId)
    .sort();
  assert.ok(ids.includes('bara-al-salafa'));
  assert.ok(ids.includes('draw-guess'));
  assert.ok(ids.includes('imposter-draw'));
  assert.ok(ids.includes('timing-challenge'));
  assert.deepEqual(
    ids.filter((id) => id === 'timing-challenge'),
    ['timing-challenge'],
  );
});

test('duplicate registration is idempotent', () => {
  const before = listRegisteredGames().length;
  registerAllGamePlugins();
  assert.equal(listRegisteredGames().length, before);

  const plugin = getGamePluginDefinition(TIMING_CHALLENGE_GAME_ID);
  assert.ok(plugin);
  registerGameDefinition(plugin);
  assert.equal(listRegisteredGames().length, before);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
