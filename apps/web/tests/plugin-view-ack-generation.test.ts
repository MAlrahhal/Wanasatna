/**
 * Plugin view SYNC must ignore stale ACKs. PHASE_CHANGED carries no view payload.
 *
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/plugin-view-ack-generation.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AckGenerationGate, runLatestAck } from '../lib/game-plugins/ack-generation';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

function pluginViewFiles(): string[] {
  const pluginsRoot = join(root, 'plugins');
  return readdirSync(pluginsRoot)
    .map((dir) => join(pluginsRoot, dir, 'use-player-view.ts'))
    .filter((file) => {
      try {
        readFileSync(file, 'utf8');
        return true;
      } catch {
        return false;
      }
    });
}

async function main(): Promise<void> {
  await test('stale ACK after a newer request is dropped', () => {
  const gate = new AckGenerationGate();
  const first = gate.next();
  const second = gate.next();
  assert.equal(gate.isCurrent(second), true);
  assert.equal(gate.isCurrent(first), false);
});

  await test('invalidate drops in-flight requests (disable / unmount)', () => {
  const gate = new AckGenerationGate();
  const requestId = gate.next();
  gate.invalidate();
  assert.equal(gate.isCurrent(requestId), false);
});

  await test('plugin state before snapshot: slower first SYNC cannot overwrite later phase', async () => {
  const gate = new AckGenerationGate();
  let applied = '';

  const slowFirst = runLatestAck(gate, async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return 'timer';
  }).then((value) => {
    if (value !== undefined) {
      applied = value;
    }
  });

  const fastSecond = runLatestAck(gate, async () => 'playing').then((value) => {
    if (value !== undefined) {
      applied = value;
    }
  });

  await Promise.all([slowFirst, fastSecond]);
  assert.equal(applied, 'playing');
});

  await test('snapshot before plugin state: later SYNC still wins', async () => {
  const gate = new AckGenerationGate();
  let applied = '';

  const first = await runLatestAck(gate, async () => 'lobby-shell');
  if (first !== undefined) {
    applied = first;
  }

  const second = await runLatestAck(gate, async () => 'round-1');
  if (second !== undefined) {
    applied = second;
  }

  assert.equal(applied, 'round-1');
});

  await test('match start + plugin state: concurrent ACKs keep the latest generation', async () => {
  const gate = new AckGenerationGate();
  const results: Array<string | undefined> = [];

  await Promise.all([
    runLatestAck(gate, async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return 'countdown';
    }).then((value) => results.push(value)),
    runLatestAck(gate, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'round-start';
    }).then((value) => results.push(value)),
    runLatestAck(gate, async () => 'turn-start').then((value) => results.push(value)),
  ]);

  const applied = results.filter((value): value is string => value !== undefined);
  assert.deepEqual(applied, ['turn-start']);
});

  await test('all plugin player-view hooks register PHASE_CHANGED before the first SYNC', () => {
  const files = pluginViewFiles();
  assert.ok(files.length >= 8, `expected plugin hooks, found ${files.length}`);

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /AckGenerationGate/, file);
    assert.match(source, /runLatestAck/, file);

    const onIdx = source.search(/socket\.on\(\s*[A-Z_]+_PHASE_CHANGED_EVENT/);
    assert.ok(onIdx >= 0, `missing PHASE_CHANGED listener in ${file}`);
    const afterOn = source.slice(onIdx);
    const syncIdx = afterOn.indexOf('void syncView()');
    const cleanupIdx = afterOn.indexOf('return () =>');
    assert.ok(syncIdx >= 0 && cleanupIdx >= 0 && syncIdx < cleanupIdx, file);
  }
});

  await test('reconnect delivers GAME_SHELL_STATE; plugins recover via SYNC not event replay', () => {
  const handlers = readFileSync(
    join(root, '..', 'server', 'src', 'modules', 'room', 'room.socket.handlers.ts'),
    'utf8',
  );
  const reconnect = handlers.slice(handlers.indexOf('export function registerReconnectHandler'));
  const shellEmit = reconnect.indexOf('GAME_SHELL_STATE_EVENT');
  const pluginPhase = reconnect.search(/PHASE_CHANGED_EVENT/);
  assert.ok(shellEmit >= 0);
  assert.equal(pluginPhase, -1);

  const timingLifecycle = readFileSync(
    join(root, '..', 'server', 'src', 'modules', 'game', 'plugins', 'timing-challenge', 'match-lifecycle.ts'),
    'utf8',
  );
  assert.match(timingLifecycle, /TIMING_CHALLENGE_PHASE_CHANGED_EVENT, \{\}/);

  const baraLifecycle = readFileSync(
    join(root, '..', 'server', 'src', 'modules', 'game', 'plugins', 'bara-al-salafa', 'match-lifecycle.ts'),
    'utf8',
  );
  assert.match(baraLifecycle, /BARA_AL_SALAFA_PHASE_CHANGED_EVENT, \{\}/);
});

  await test('lobby presence mapping keeps DISCONNECTED seats visible as offline, not LEFT', () => {
  const mapPlayer = readFileSync(join(root, 'lib', 'room', 'map-player.ts'), 'utf8');
  assert.match(mapPlayer, /player\.status === 'CONNECTED'/);
  const playerCard = readFileSync(join(root, 'components', 'lobby', 'player-card.tsx'), 'utf8');
  assert.match(playerCard, /غير متصل/);
  assert.doesNotMatch(playerCard, /غادر/);
});

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
