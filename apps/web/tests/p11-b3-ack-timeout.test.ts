/**
 * P11-B.3: Game Shell / Plugin ACK timeout maps to CONNECTION_FAILED.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGameShellErrorMessage } from '../lib/game-shell/error-messages';
import { getRoomErrorMessage } from '../lib/room/error-messages';
import {
  localizePluginAck,
  pickAckResponse,
  resolveGameAck,
} from '../lib/socket/ack-response';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

const timeoutError = new Error('operation has timed out');

test('1. Game Shell ACK success is unchanged', () => {
  const result = resolveGameAck(undefined, { success: true, data: { state: { shellId: 's1' } } });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal((result.data as { state: { shellId: string } }).state.shellId, 's1');
  }
});

test('2. Game Shell structured server error is unchanged', () => {
  const result = resolveGameAck(undefined, {
    success: false,
    error: { code: 'NOT_HOST', message: 'host only' },
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'NOT_HOST');
  }
});

test('3. Game Shell ACK timeout maps to CONNECTION_FAILED', () => {
  const result = resolveGameAck(timeoutError, undefined);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'CONNECTION_FAILED');
    assert.equal(result.error.message, getRoomErrorMessage('CONNECTION_FAILED'));
    assert.equal(result.error.message, getGameShellErrorMessage('CONNECTION_FAILED'));
    assert.doesNotMatch(result.error.message, /timeout|socket|ack|ms/i);
  }
});

test('4. Plugin ACK success is unchanged', () => {
  const raw = resolveGameAck(undefined, { success: true, data: { view: { roundId: 'r1' } } });
  const result = localizePluginAck(raw);
  assert.equal(result.success, true);
});

test('5. Plugin structured server error is unchanged', () => {
  const raw = resolveGameAck(undefined, {
    success: false,
    error: { code: 'NOT_PARTICIPANT', message: 'not in this round' },
  });
  const result = localizePluginAck(raw);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'NOT_PARTICIPANT');
    assert.equal(result.error.message, getGameShellErrorMessage('NOT_PARTICIPANT'));
  }
});

test('6. Plugin ACK timeout maps to CONNECTION_FAILED', () => {
  const result = localizePluginAck(resolveGameAck(timeoutError, undefined));
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'CONNECTION_FAILED');
    assert.equal(result.error.message, getRoomErrorMessage('CONNECTION_FAILED'));
  }
});

test('7. RATE_LIMITED remains RATE_LIMITED', () => {
  const result = resolveGameAck(undefined, {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'slow down' },
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'RATE_LIMITED');
  }
});

test('8. INTERNAL_ERROR returned by server remains INTERNAL_ERROR', () => {
  const result = resolveGameAck(undefined, {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'boom' },
  });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, 'INTERNAL_ERROR');
  }
});

test('9. no raw Socket.IO timeout string reaches the user', () => {
  const message = getGameShellErrorMessage('CONNECTION_FAILED');
  assert.equal(message, 'تعذر الاتصال. حاول مرة أخرى.');
  assert.doesNotMatch(message, /operation has timed out|Socket\.IO|ACK/i);
});

test('10. Room V2 emit still maps unresolved ACK to CONNECTION_FAILED', () => {
  const emit = read('lib/room-v2/emit.ts');
  assert.match(emit, /pickAckResponse/);
  assert.match(emit, /code: 'CONNECTION_FAILED'/);
  assert.match(emit, /timeoutMs = 10_000/);
  assert.doesNotMatch(emit, /location\.reload|retryMutation|resubmit/);
});

test('dual-shape ACK payload in the error slot is accepted', () => {
  const result = resolveGameAck({ success: true, data: { ok: true } }, undefined);
  assert.equal(result.success, true);
});

test('timeout helpers keep 10s ACK and do not auto-retry mutations', () => {
  const shell = read('lib/game-shell/emit.ts');
  const plugin = read('lib/game-plugins/emit.ts');
  assert.match(shell, /timeout\(10000\)/);
  assert.match(plugin, /timeout\(10000\)/);
  assert.match(shell, /resolveGameAck/);
  assert.match(plugin, /resolveGameAck/);
  assert.doesNotMatch(shell, /setInterval|resubmit|retryMutation/);
  assert.doesNotMatch(plugin, /setInterval|resubmit|retryMutation/);
});

test('pending Start Game / submit flags clear after ACK failure', () => {
  const start = read('components/lobby/lobby-start-game-panel.tsx');
  const fast = read('plugins/fast-answer/use-player-view.ts');
  const gc = read('plugins/guessing-challenge/use-player-view.ts');
  assert.match(start, /finally \{/);
  assert.match(start, /setIsStarting\(false\)/);
  assert.match(fast, /setIsSubmittingAction\(false\)/);
  assert.match(gc, /setIsSubmittingAction\(false\)/);
});

test('pickAckResponse prefers a valid response over a timeout error', () => {
  const picked = pickAckResponse(
    timeoutError,
    { success: true, data: 1 },
    (value): value is { success: true; data: number } =>
      typeof value === 'object' && value !== null && 'success' in value,
  );
  assert.deepEqual(picked, { success: true, data: 1 });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
