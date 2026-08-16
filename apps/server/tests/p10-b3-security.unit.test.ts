/**
 * P10-B.3 security polish: LOOK flood, names, reconnect public errors, limiter regression.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/p10-b3-security.unit.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Socket } from 'socket.io';
import {
  consumeConnectLimit,
  consumeCreateRoomLimit,
  consumeGameSyncLimit,
  consumeJoinRoomLimit,
  consumeLookLimit,
  consumeReconnectLimit,
  consumeRoomSyncLimit,
  resetAbuseLimiterForTests,
  setAbuseLimiterNow,
} from '../src/lib/abuse-limiter.js';
import { SOCKET_MAX_HTTP_BUFFER_SIZE } from '../src/lib/socket-limits.js';
import { isOversizedGameAnswer } from '../src/modules/game/runtime/game-answer-text.js';
import { toPublicReconnectFailure } from '../src/modules/room/room-abuse.js';
import {
  validateCreateRoomPayload,
  validateJoinRoomPayload,
} from '../src/modules/room/room.validators.js';

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
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function fakeSocket(id: string, ip = '203.0.113.9'): Socket {
  return {
    id,
    handshake: { headers: { 'x-real-ip': ip }, address: ip },
    conn: { remoteAddress: ip },
  } as unknown as Socket;
}

test('LOOK: 10/sec accepted, burst 30, over-limit dropped, refill, independent sockets', () => {
  resetAbuseLimiterForTests();
  let now = 5_000_000;
  setAbuseLimiterNow(() => now);
  const socket = fakeSocket('look-a');

  for (let index = 0; index < 10; index += 1) {
    assert.equal(consumeLookLimit(socket), true);
    now += 100;
  }

  resetAbuseLimiterForTests();
  setAbuseLimiterNow(() => now);
  const burst = fakeSocket('look-burst');
  for (let index = 0; index < 30; index += 1) {
    assert.equal(consumeLookLimit(burst), true);
  }
  assert.equal(consumeLookLimit(burst), false);

  now += 50;
  assert.equal(consumeLookLimit(burst), true);

  const other = fakeSocket('look-b');
  assert.equal(consumeLookLimit(other), true);
});

test('LOOK handler rate-limits before state/broadcast and silently drops', () => {
  const source = read('src/modules/game/plugins/guessing-challenge/socket.handlers.ts');
  const match = /socket\.on\(\s*GUESSING_CHALLENGE_LOOK_EVENT/.exec(source);
  assert.ok(match && match.index >= 0);
  const start = match.index;
  const next = source.indexOf('socket.on(', start + match[0].length);
  const block = next === -1 ? source.slice(start) : source.slice(start, next);
  assert.ok(block.indexOf('consumeLookLimit') < block.indexOf('applyLookDirection'));
  assert.ok(block.indexOf('consumeLookLimit') < block.indexOf('ensureGuessingChallengeMatchStateWithTimer'));
  assert.ok(block.indexOf('consumeLookLimit') < block.indexOf('LOOK_UPDATE_EVENT'));
  assert.match(block, /if \(!consumeLookLimit\(socket\)\) \{\s*return;/);
  assert.doesNotMatch(block, /if \(!consumeLookLimit\(socket\)\) \{\s*sendGameResponse/);
});

test('Draw Guess / Fast Answer reject 151 before matching', () => {
  assert.equal(isOversizedGameAnswer('ا'.repeat(150)), false);
  assert.equal(isOversizedGameAnswer('ا'.repeat(151)), true);

  const draw = read('src/modules/game/plugins/draw-guess/socket.handlers.ts');
  const drawStart = draw.indexOf('DRAW_GUESS_SUBMIT_GUESS_EVENT');
  const drawBlock = draw.slice(drawStart, draw.indexOf('DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT', drawStart));
  assert.ok(drawBlock.indexOf('isOversizedGameAnswer') < drawBlock.indexOf('isCorrectGuess'));
  assert.ok(drawBlock.indexOf('isOversizedGameAnswer') < drawBlock.indexOf('endDrawingRound'));

  const fast = read('src/modules/game/plugins/fast-answer/socket.handlers.ts');
  const fastStart = fast.indexOf('FAST_ANSWER_SUBMIT_ANSWER_EVENT');
  const fastBlock = fast.slice(fastStart, fast.indexOf('FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT', fastStart));
  assert.ok(fastBlock.indexOf('isOversizedGameAnswer') < fastBlock.indexOf('isCorrectAnswer'));
  assert.ok(fastBlock.indexOf('isOversizedGameAnswer') < fastBlock.indexOf('tryAcceptCorrectAnswer'));
});

test('player names: Arabic/English/emoji ZWJ ok; Cc and bidi rejected; 2–20 unchanged', () => {
  assert.equal(validateCreateRoomPayload({ playerName: 'محمد' }).success, true);
  assert.equal(validateJoinRoomPayload({ playerName: 'Khaled', roomCode: '123456' }).success, true);
  assert.equal(validateCreateRoomPayload({ playerName: '👨‍👩‍👧' }).success, true);
  assert.equal(validateCreateRoomPayload({ playerName: 'أب' }).success, true);
  assert.equal(validateCreateRoomPayload({ playerName: 'ا'.repeat(20) }).success, true);
  assert.equal(validateCreateRoomPayload({ playerName: 'ا'.repeat(21) }).success, false);
  assert.equal(validateCreateRoomPayload({ playerName: 'م' }).success, false);

  const newline = validateCreateRoomPayload({ playerName: 'محمد\nعلي' });
  assert.equal(newline.success, false);
  const tab = validateJoinRoomPayload({ playerName: 'محمد\tعلي', roomCode: '123456' });
  assert.equal(tab.success, false);
  assert.equal(validateCreateRoomPayload({ playerName: `محمد\u202E` }).success, false);
  assert.equal(validateJoinRoomPayload({ playerName: `خالد\u2067`, roomCode: '123456' }).success, false);
  assert.equal(validateCreateRoomPayload({ playerName: `سارة\u061C` }).success, false);

  const createRule = read('src/modules/room/room.validators.ts');
  assert.match(createRule, /playerNameSchema/);
  assert.match(createRule, /createRoomSchema[\s\S]*playerName: playerNameSchema/);
  assert.match(createRule, /joinRoomSchema[\s\S]*playerName: playerNameSchema/);
});

test('reconnect PLAYER_NOT_FOUND is public RECONNECT_INVALID_TOKEN; expired stays distinct', () => {
  const missing = toPublicReconnectFailure({
    success: false,
    error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found.' },
  });
  const wrongToken = toPublicReconnectFailure({
    success: false,
    error: { code: 'RECONNECT_INVALID_TOKEN', message: 'Reconnect credential is invalid or expired.' },
  });
  assert.equal(missing.error.code, 'RECONNECT_INVALID_TOKEN');
  assert.equal(wrongToken.error.code, 'RECONNECT_INVALID_TOKEN');
  assert.equal(missing.error.code, wrongToken.error.code);

  const expired = toPublicReconnectFailure({
    success: false,
    error: { code: 'RECONNECT_EXPIRED', message: 'Reconnect window has expired.' },
  });
  assert.equal(expired.error.code, 'RECONNECT_EXPIRED');

  const reconnect = read('src/modules/room/room.socket.handlers.ts');
  assert.match(reconnect, /toPublicReconnectFailure\(response\)/);
});

test('P10-B.2 limiter policies and 64 KiB buffer unchanged', () => {
  resetAbuseLimiterForTests();
  const create = fakeSocket('c1', '198.51.100.1');
  assert.equal(consumeCreateRoomLimit(create), true);
  assert.equal(consumeCreateRoomLimit(create), true);
  assert.equal(consumeCreateRoomLimit(create), true);
  assert.equal(consumeCreateRoomLimit(create), false);

  const join = fakeSocket('j1', '198.51.100.2');
  for (let index = 0; index < 20; index += 1) {
    assert.equal(consumeJoinRoomLimit(join), true);
  }
  assert.equal(consumeJoinRoomLimit(join), false);

  const reconnect = fakeSocket('r1', '198.51.100.3');
  for (let index = 0; index < 30; index += 1) {
    assert.equal(consumeReconnectLimit(reconnect), true);
  }
  assert.equal(consumeReconnectLimit(reconnect), false);

  const sync = fakeSocket('s1', '198.51.100.4');
  assert.equal(consumeRoomSyncLimit(sync), true);
  assert.equal(consumeRoomSyncLimit(sync), true);
  assert.equal(consumeRoomSyncLimit(sync), true);
  assert.equal(consumeRoomSyncLimit(sync), true);
  assert.equal(consumeRoomSyncLimit(sync), false);

  const game = fakeSocket('g1', '198.51.100.5');
  assert.equal(consumeGameSyncLimit(game), true);
  assert.equal(consumeGameSyncLimit(game), true);
  assert.equal(consumeGameSyncLimit(game), true);
  assert.equal(consumeGameSyncLimit(game), true);
  assert.equal(consumeGameSyncLimit(game), false);

  const connect = fakeSocket('n1', '198.51.100.6');
  let allowed = 0;
  for (let index = 0; index < 130; index += 1) {
    if (consumeConnectLimit(connect)) {
      allowed += 1;
    }
  }
  assert.equal(allowed, 120);
  assert.equal(SOCKET_MAX_HTTP_BUFFER_SIZE, 64 * 1024);
});

resetAbuseLimiterForTests();
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
