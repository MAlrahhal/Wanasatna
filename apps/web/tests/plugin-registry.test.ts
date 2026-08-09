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
    [
      'bara-al-salafa',
      'draw-guess',
      'fast-answer',
      'guessing-challenge',
      'imposter-draw',
      'judge',
      'timing-challenge',
      'who-wrote-it',
    ],
  );
});

test('fast-answer client plugin is registered', () => {
  assert.equal(hasClientGamePlugin('fast-answer'), true);
  const plugin = getClientGamePlugin('fast-answer');
  assert.ok(plugin);
  assert.equal(plugin.metadata.id, 'fast-answer');
  assert.equal(plugin.metadata.minPlayers, 2);
  assert.equal(typeof plugin.GameScreen, 'function');
});

test('who-wrote-it client plugin is registered', () => {
  assert.equal(hasClientGamePlugin('who-wrote-it'), true);
  const plugin = getClientGamePlugin('who-wrote-it');
  assert.ok(plugin);
  assert.equal(plugin.metadata.id, 'who-wrote-it');
  assert.equal(plugin.metadata.minPlayers, 3);
  assert.equal(typeof plugin.GameScreen, 'function');
});

test('judge client plugin is registered', () => {
  assert.equal(hasClientGamePlugin('judge'), true);
  const plugin = getClientGamePlugin('judge');
  assert.ok(plugin);
  assert.equal(plugin.metadata.id, 'judge');
  assert.equal(plugin.metadata.minPlayers, 3);
  assert.equal(typeof plugin.GameScreen, 'function');
});

test('guessing-challenge client plugin is registered', () => {
  assert.equal(hasClientGamePlugin('guessing-challenge'), true);
  const plugin = getClientGamePlugin('guessing-challenge');
  assert.ok(plugin);
  assert.equal(plugin.metadata.id, 'guessing-challenge');
  assert.equal(plugin.metadata.minPlayers, 2);
  assert.equal(typeof plugin.GameScreen, 'function');
});

test('timing-challenge client plugin is registered', () => {
  assert.equal(hasClientGamePlugin('timing-challenge'), true);
  const plugin = getClientGamePlugin('timing-challenge');
  assert.ok(plugin);
  assert.equal(plugin.metadata.id, 'timing-challenge');
  assert.equal(plugin.metadata.minPlayers, 2);
  assert.equal(typeof plugin.GameScreen, 'function');
});

test('timing-challenge lobby catalog ID matches plugin ID', () => {
  assert.equal(hasClientGamePlugin('timing-challenge'), true);
  assert.equal(getClientGamePlugin('timing-challenge')?.metadata.id, 'timing-challenge');
});

test('re-running registration is idempotent (Strict Mode / Fast Refresh safe)', () => {
  registerAllClientGamePlugins();
  registerAllClientGamePlugins();
  assert.equal(listClientGamePlugins().length, 8, 'no duplicate registrations');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
