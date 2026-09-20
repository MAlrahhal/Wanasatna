import assert from 'node:assert/strict';
import type { GameShellState, MarathonState } from '@wanasatna/shared';
import {
  planAuthoritativeRoomRoute,
  type AuthoritativeRoomRouteSnapshot,
} from '../lib/room/authoritative-route';

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
    console.error(error);
  }
}

function shell(phase: GameShellState['phase'] = 'PLAYING'): GameShellState {
  return { phase } as GameShellState;
}

function marathon(
  status: MarathonState['status'],
  activeShellId: string | null = null,
): MarathonState {
  return { status, activeShellId } as MarathonState;
}

function snapshot(
  gameShell: GameShellState | null,
  marathonState: MarathonState | null,
): AuthoritativeRoomRouteSnapshot {
  return {
    gameShell: { status: 'ready', state: gameShell },
    marathon: { status: 'ready', state: marathonState },
  };
}

test('missed normal-game navigation self-heals from authoritative shell state', () => {
  assert.deepEqual(
    planAuthoritativeRoomRoute({
      pathname: '/lobby',
      roomCode: '123456',
      snapshot: snapshot(shell(), null),
    }),
    { pathname: '/game', href: '/game' },
  );
});

test('duplicate active-shell information is idempotent on the game route', () => {
  assert.equal(
    planAuthoritativeRoomRoute({
      pathname: '/game',
      roomCode: '123456',
      snapshot: snapshot(shell(), null),
    }),
    null,
  );
});

test('unknown Marathon state cannot prematurely bounce an empty game shell to Lobby', () => {
  assert.equal(
    planAuthoritativeRoomRoute({
      pathname: '/game',
      roomCode: '123456',
      snapshot: {
        gameShell: { status: 'ready', state: null },
        marathon: { status: 'unknown' },
      },
    }),
    null,
  );
});

test('authoritative empty runtimes recover a stale game route to the coded Lobby URL', () => {
  assert.deepEqual(
    planAuthoritativeRoomRoute({
      pathname: '/game',
      roomCode: '123456',
      snapshot: snapshot(null, null),
    }),
    { pathname: '/lobby', href: '/lobby?code=123456' },
  );
});

test('a finished shell never pulls a Lobby client back into Game', () => {
  assert.equal(
    planAuthoritativeRoomRoute({
      pathname: '/lobby',
      roomCode: '123456',
      snapshot: snapshot(shell('FINISHED'), null),
    }),
    null,
  );
});

for (const status of ['PREPARING', 'TRANSITION', 'FINISHED'] as const) {
  test(`missed game-to-Marathon navigation self-heals for ${status}`, () => {
    assert.deepEqual(
      planAuthoritativeRoomRoute({
        pathname: '/game',
        roomCode: '123456',
        snapshot: snapshot(null, marathon(status)),
      }),
      { pathname: '/marathon', href: '/marathon' },
    );
  });
}

test('missed Marathon-to-game navigation self-heals from the active leg', () => {
  assert.deepEqual(
    planAuthoritativeRoomRoute({
      pathname: '/marathon',
      roomCode: '123456',
      snapshot: snapshot(shell(), marathon('PLAYING', 'shell-1')),
    }),
    { pathname: '/game', href: '/game' },
  );
});

test('an active Marathon leg routes to Game even if the shell ACK is still pending', () => {
  assert.deepEqual(
    planAuthoritativeRoomRoute({
      pathname: '/marathon',
      roomCode: '123456',
      snapshot: {
        gameShell: { status: 'unknown' },
        marathon: { status: 'ready', state: marathon('PLAYING', 'shell-1') },
      },
    }),
    { pathname: '/game', href: '/game' },
  );
});

test('clearing a finished Marathon lets a later normal shell self-heal to Game', () => {
  assert.equal(
    planAuthoritativeRoomRoute({
      pathname: '/marathon',
      roomCode: '123456',
      snapshot: snapshot(shell(), marathon('FINISHED')),
    }),
    null,
  );
  assert.deepEqual(
    planAuthoritativeRoomRoute({
      pathname: '/marathon',
      roomCode: '123456',
      snapshot: snapshot(shell(), null),
    }),
    { pathname: '/game', href: '/game' },
  );
});

test('final Marathon cleanup needs both null runtime snapshots to recover to Lobby', () => {
  assert.equal(
    planAuthoritativeRoomRoute({
      pathname: '/marathon',
      roomCode: '123456',
      snapshot: snapshot(shell('FINISHED'), null),
    }),
    null,
  );
  assert.deepEqual(
    planAuthoritativeRoomRoute({
      pathname: '/marathon',
      roomCode: '123456',
      snapshot: snapshot(null, null),
    }),
    { pathname: '/lobby', href: '/lobby?code=123456' },
  );
});

test('duplicate Marathon transition state does not create a redirect loop', () => {
  assert.equal(
    planAuthoritativeRoomRoute({
      pathname: '/marathon',
      roomCode: '123456',
      snapshot: snapshot(null, marathon('TRANSITION')),
    }),
    null,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
