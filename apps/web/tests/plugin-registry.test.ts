/**
 * Regression test for the client plugin registration race:
 * importing the plugin bootstrap must populate the registry synchronously,
 * without rendering anything or running any React effects.
 * Run from apps/web: ..\server\node_modules\.bin\tsx tests\plugin-registry.test.ts
 */
import assert from 'node:assert/strict';
import '@/plugins';
import {
  getClientGamePlugin,
  hasClientGamePlugin,
  listClientGamePlugins,
} from '@/lib/game-plugins/registry';
import { registerAllClientGamePlugins } from '@/plugins';

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

test('registry is populated immediately after importing the bootstrap', () => {
  assert.equal(hasClientGamePlugin('bara-al-salafa'), true);
  const plugin = getClientGamePlugin('bara-al-salafa');
  assert.ok(plugin, 'bara-al-salafa resolves without running effects');
  assert.equal(plugin.metadata.id, 'bara-al-salafa');
  assert.equal(plugin.metadata.minPlayers, 3);
  assert.equal(typeof plugin.GameScreen, 'function');
});

test('all known plugin ids are registered exactly once', () => {
  const ids = listClientGamePlugins().map((plugin) => plugin.metadata.id);
  assert.deepEqual(
    [...ids].sort(),
    ['bara-al-salafa', 'draw-guess', 'imposter-draw', 'judge'],
  );
});

test('re-running registration is idempotent (Strict Mode / Fast Refresh safe)', () => {
  registerAllClientGamePlugins();
  registerAllClientGamePlugins();
  assert.equal(listClientGamePlugins().length, 4, 'no duplicate registrations');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
