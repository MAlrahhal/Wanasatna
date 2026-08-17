/**
 * QA hardening regression tests (H1 + M1).
 *
 * H1 — shared Socket.IO listener cleanup must be handler-specific so one
 *      provider can never wipe another provider's listener.
 * M1 — /game navigation suppression must evaluate the LATEST shell state
 *      (ref pattern), never a stale captured closure value.
 *
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/socket-listener-hardening.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import {
  GAME_SHELL_STATE_EVENT,
  isWaitingForNextMatch,
  type GameShellState,
} from '@wanasatna/shared';

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

function makeShell(overrides: Partial<GameShellState>): GameShellState {
  return {
    shellId: 'shell-1',
    roomId: 'room-1',
    gameId: 'bara-al-salafa',
    phase: 'PLAYING',
    hostPlayerId: 'host',
    players: [],
    readyPlayerIds: [],
    countdownSeconds: null,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: null,
    finishedAt: null,
    updatedAt: new Date().toISOString(),
    matchParticipantIds: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// H1 — handler-specific listener ownership on a real shared socket instance
// ---------------------------------------------------------------------------

const socket = io('http://127.0.0.1:65500', { autoConnect: false });

test('H1: room-context cleanup removes only its own shell-state handler', () => {
  const received: string[] = [];

  const gameShellHandler = () => received.push('game-shell');
  let roomHandler = () => received.push('room-v1');

  // GameShellProvider registers first (player already on /game).
  socket.on(GAME_SHELL_STATE_EVENT, gameShellHandler);

  // RoomContext registers with handler-specific cleanup tracking.
  socket.on(GAME_SHELL_STATE_EVENT, roomHandler);
  let cleanupRoom = () => socket.off(GAME_SHELL_STATE_EVENT, roomHandler);

  assert.equal(socket.listeners(GAME_SHELL_STATE_EVENT).length, 2);

  // Simulate refresh/reconnect: RoomContext re-registers its listener.
  cleanupRoom();
  roomHandler = () => received.push('room-v2');
  socket.on(GAME_SHELL_STATE_EVENT, roomHandler);
  cleanupRoom = () => socket.off(GAME_SHELL_STATE_EVENT, roomHandler);

  // No duplicates, and the GameShell listener survived re-registration.
  const listeners = socket.listeners(GAME_SHELL_STATE_EVENT);
  assert.equal(listeners.length, 2);
  assert.ok(listeners.includes(gameShellHandler));

  // Both remaining handlers still receive events.
  listeners.forEach((listener) => listener({}));
  assert.deepEqual(received, ['game-shell', 'room-v2']);

  // RoomContext unmount removes only its own handler.
  cleanupRoom();
  assert.deepEqual(socket.listeners(GAME_SHELL_STATE_EVENT), [gameShellHandler]);

  socket.off(GAME_SHELL_STATE_EVENT, gameShellHandler);
  assert.equal(socket.listeners(GAME_SHELL_STATE_EVENT).length, 0);
});

test('H1: room-context source contains no argument-less socket.off cleanup', () => {
  const source = readFileSync(join(__dirname, '..', 'contexts', 'room-context.tsx'), 'utf8');

  // socket.off(EVENT) / socket.io.off('reconnect') with no handler argument
  // would wipe listeners owned by other providers.
  const argumentlessOff = /socket(?:\.io)?\.off\(\s*[^,\s)]+\s*\)/g;
  const matches = source.match(argumentlessOff) ?? [];
  assert.deepEqual(matches, [], `argument-less socket.off found: ${matches.join(', ')}`);
});

test('H1: game-shell-context source uses handler-specific cleanup', () => {
  const source = readFileSync(join(__dirname, '..', 'contexts', 'game-shell-context.tsx'), 'utf8');
  const argumentlessOff = /socket(?:\.io)?\.off\(\s*[^,\s)]+\s*\)/g;
  const matches = source.match(argumentlessOff) ?? [];
  assert.deepEqual(matches, [], `argument-less socket.off found: ${matches.join(', ')}`);
});

// ---------------------------------------------------------------------------
// M1 — spectators watch the live match; /game navigation is never suppressed
// ---------------------------------------------------------------------------

test('M1: room-context does not suppress /game navigation for spectators', () => {
  const source = readFileSync(join(__dirname, '..', 'contexts', 'room-context.tsx'), 'utf8');

  assert.ok(
    source.includes('activeGameShellRef.current'),
    'shell listeners still keep the live ref current',
  );
  assert.doesNotMatch(
    source,
    /isWaitingForNextMatch\(\s*activeGameShellRef\.current/,
    'spectators must be allowed to open /game',
  );
  assert.match(source, /router\.push\('\/game'\)/);
});

test('M1: waiting-for-next-match helper still identifies locked-out joiners', () => {
  const playing = makeShell({ phase: 'PLAYING', matchParticipantIds: ['p1', 'p2'] });
  assert.equal(isWaitingForNextMatch(playing, 'ahmed'), true);
  assert.equal(isWaitingForNextMatch(playing, 'p1'), false);
  assert.equal(isWaitingForNextMatch(null, 'ahmed'), false);
});

socket.close();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
