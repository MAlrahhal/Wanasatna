/**
 * P11-B.1: /game + authoritative null Game Shell recovers to Lobby.
 * Pending sync is loading; success+null is not loading.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameShellState } from '@wanasatna/shared';
import {
  applyLiveShellState,
  applyShellSyncResponse,
  beginShellSync,
  createPendingShellSyncView,
  LOBBY_NOTICE_STORAGE_KEY,
  planNullShellLobbyRecovery,
  shouldRecoverGameRouteToLobby,
  writeLobbyNotice,
  type ShellSyncView,
} from '../lib/game-shell/null-shell-recovery';
import { buildLobbyUrl, ROOM_SESSION_STORAGE_KEYS } from '../lib/room/session';
import { ACTIVE_ROOM_SESSION_KEY } from '../lib/room-v2/types';
import { RECONNECT_CLAIMS_STORAGE_KEY } from '../lib/room-v2/reconnect-claims';
import { ACTIVE_ROOM_RESUME_STORAGE_KEY } from '../lib/room/reconnect-credential';
import { SYSTEM_COPY } from '../lib/ui/system-copy';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOM_CODE = '482910';
const LOBBY_URL = `/lobby?code=${ROOM_CODE}`;

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

function makeShell(overrides: Partial<GameShellState> = {}): GameShellState {
  return {
    shellId: 'shell-a',
    roomId: 'room-1',
    gameId: 'draw-guess',
    phase: 'PLAYING',
    hostPlayerId: 'host-1',
    players: [],
    readyPlayerIds: [],
    countdownSeconds: null,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: null,
    finishedAt: null,
    updatedAt: '2026-08-16T12:00:00.000Z',
    matchParticipantIds: ['p1', 'p2'],
    ...overrides,
  };
}

function sync(
  view: ShellSyncView,
  response:
    | { success: true; state: GameShellState | null }
    | { success: false; code: string; message: string },
): ShellSyncView {
  const started = beginShellSync(view);
  return applyShellSyncResponse({
    requestGeneration: started.requestGeneration,
    current: started.view,
    response,
  });
}

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
}

function installBrowserStorage(): { session: MemoryStorage; local: MemoryStorage } {
  const session = new MemoryStorage();
  const local = new MemoryStorage();
  const host = globalThis as unknown as {
    sessionStorage: MemoryStorage;
    localStorage: MemoryStorage;
    window: { sessionStorage: MemoryStorage; localStorage: MemoryStorage };
  };
  host.sessionStorage = session;
  host.localStorage = local;
  host.window = { sessionStorage: session, localStorage: local };
  return { session, local };
}

function seedRoomIdentity(session: MemoryStorage, local: MemoryStorage): void {
  session.setItem(ROOM_SESSION_STORAGE_KEYS.playerId, 'p1');
  session.setItem(ROOM_SESSION_STORAGE_KEYS.roomId, 'room-1');
  session.setItem(ROOM_SESSION_STORAGE_KEYS.playerName, 'أحمد');
  session.setItem(ROOM_SESSION_STORAGE_KEYS.roomCode, ROOM_CODE);
  session.setItem(
    ACTIVE_ROOM_SESSION_KEY,
    JSON.stringify({
      roomId: 'room-1',
      roomCode: ROOM_CODE,
      playerId: 'p1',
      playerName: 'أحمد',
      reconnectToken: 'token-keep',
    }),
  );
  session.setItem(
    ACTIVE_ROOM_RESUME_STORAGE_KEY,
    JSON.stringify({
      playerId: 'p1',
      roomId: 'room-1',
      roomCode: ROOM_CODE,
      reconnectToken: 'token-keep',
    }),
  );
  local.setItem(
    RECONNECT_CLAIMS_STORAGE_KEY,
    JSON.stringify({
      [`${ROOM_CODE}\u001fأحمد`]: {
        roomId: 'room-1',
        roomCode: ROOM_CODE,
        playerId: 'p1',
        playerName: 'أحمد',
        reconnectToken: 'token-keep',
      },
    }),
  );
}

function assertIdentityPreserved(session: MemoryStorage, local: MemoryStorage): void {
  assert.equal(session.getItem(ROOM_SESSION_STORAGE_KEYS.playerId), 'p1');
  assert.equal(session.getItem(ROOM_SESSION_STORAGE_KEYS.roomId), 'room-1');
  assert.equal(session.getItem(ROOM_SESSION_STORAGE_KEYS.playerName), 'أحمد');
  assert.equal(session.getItem(ROOM_SESSION_STORAGE_KEYS.roomCode), ROOM_CODE);
  assert.match(session.getItem(ACTIVE_ROOM_SESSION_KEY) ?? '', /token-keep/);
  assert.match(session.getItem(ACTIVE_ROOM_RESUME_STORAGE_KEY) ?? '', /token-keep/);
  assert.match(local.getItem(RECONNECT_CLAIMS_STORAGE_KEY) ?? '', /token-keep/);
}

test('1. initial pending sync is not a Lobby recovery', () => {
  const pending = createPendingShellSyncView();
  assert.equal(pending.status, 'pending');
  assert.equal(pending.state, null);
  assert.equal(shouldRecoverGameRouteToLobby('/game', pending.status), false);
  assert.deepEqual(
    planNullShellLobbyRecovery({
      pathname: '/game',
      syncStatus: pending.status,
      roomCode: ROOM_CODE,
    }),
    { recover: false },
  );
});

test('2. existing shell renders game and does not redirect Lobby', () => {
  const view = sync(createPendingShellSyncView(), { success: true, state: makeShell() });
  assert.equal(view.status, 'ready');
  assert.equal(view.state?.shellId, 'shell-a');
  assert.equal(shouldRecoverGameRouteToLobby('/game', view.status), false);
  assert.deepEqual(
    planNullShellLobbyRecovery({
      pathname: '/game',
      syncStatus: view.status,
      roomCode: ROOM_CODE,
    }),
    { recover: false },
  );
});

test('3. authoritative null shell sets Lobby notice and replace URL', () => {
  const { session, local } = installBrowserStorage();
  seedRoomIdentity(session, local);

  const view = sync(createPendingShellSyncView(), { success: true, state: null });
  assert.equal(view.status, 'empty');
  assert.equal(view.state, null);

  const plan = planNullShellLobbyRecovery({
    pathname: '/game',
    syncStatus: view.status,
    roomCode: ROOM_CODE,
  });
  assert.equal(plan.recover, true);
  if (!plan.recover) {
    throw new Error('expected recovery');
  }
  assert.equal(plan.lobbyUrl, LOBBY_URL);
  assert.equal(plan.lobbyUrl, buildLobbyUrl(ROOM_CODE));
  assert.equal(plan.notice, SYSTEM_COPY.gameEndedReturnLobby);
  assert.equal(plan.notice, 'انتهت الجولة أو تمت إعادة تشغيل اللعبة، ورجعناك إلى اللوبي.');
  assert.doesNotMatch(plan.notice, /Railway|crash|shell|process|server/i);

  writeLobbyNotice(plan.notice);
  assert.equal(session.getItem(LOBBY_NOTICE_STORAGE_KEY), plan.notice);
  assertIdentityPreserved(session, local);

  const page = read('app/(room)/game/game-page-client.tsx');
  assert.match(page, /writeLobbyNotice\(plan\.notice\)/);
  assert.match(page, /router\.replace\(plan\.lobbyUrl\)/);
  assert.doesNotMatch(page, /router\.push\(/);
});

test('4. simulated process restart: Room identity is not cleared', () => {
  const { session, local } = installBrowserStorage();
  seedRoomIdentity(session, local);

  const view = sync(createPendingShellSyncView(), { success: true, state: null });
  const plan = planNullShellLobbyRecovery({
    pathname: '/game',
    syncStatus: view.status,
    roomCode: ROOM_CODE,
  });
  assert.equal(plan.recover, true);
  if (plan.recover) {
    writeLobbyNotice(plan.notice);
  }

  const page = read('app/(room)/game/game-page-client.tsx');
  const recovery = read('lib/game-shell/null-shell-recovery.ts');
  const context = read('contexts/game-shell-context.tsx');
  for (const source of [page, recovery, context]) {
    assert.doesNotMatch(source, /leaveRoom\(/);
    assert.doesNotMatch(source, /clearLocalParticipation/);
    assert.doesNotMatch(source, /removeReconnectClaim/);
    assert.doesNotMatch(source, /clearRoomSession/);
    assert.doesNotMatch(source, /clearPersistedActiveRoomSession/);
  }
  assertIdentityPreserved(session, local);
});

test('5. missed GAME_SHELL_NAVIGATE uses the same null-shell recovery', () => {
  const afterMissedNavigate = sync(createPendingShellSyncView(), {
    success: true,
    state: null,
  });
  const afterRestart = sync(createPendingShellSyncView(), {
    success: true,
    state: null,
  });
  assert.deepEqual(
    planNullShellLobbyRecovery({
      pathname: '/game',
      syncStatus: afterMissedNavigate.status,
      roomCode: ROOM_CODE,
    }),
    planNullShellLobbyRecovery({
      pathname: '/game',
      syncStatus: afterRestart.status,
      roomCode: ROOM_CODE,
    }),
  );

  const context = read('contexts/game-shell-context.tsx');
  assert.match(context, /GAME_SHELL_SYNC_EVENT/);
  assert.match(context, /applyShellSyncResponse/);
  assert.match(context, /status: 'empty'/);
});

test('6. transient CONNECTION_FAILED / ACK timeout does not redirect Lobby', () => {
  for (const code of ['CONNECTION_FAILED', 'INTERNAL_ERROR'] as const) {
    const view = sync(createPendingShellSyncView(), {
      success: false,
      code,
      message: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
    });
    assert.equal(view.status, 'error');
    assert.equal(shouldRecoverGameRouteToLobby('/game', view.status), false);
    assert.deepEqual(
      planNullShellLobbyRecovery({
        pathname: '/game',
        syncStatus: view.status,
        roomCode: ROOM_CODE,
      }),
      { recover: false },
    );
  }
});

test('7. RATE_LIMITED does not redirect Lobby', () => {
  const pendingRateLimit = sync(createPendingShellSyncView(), {
    success: false,
    code: 'RATE_LIMITED',
    message: SYSTEM_COPY.rateLimited,
  });
  assert.equal(pendingRateLimit.status, 'error');
  assert.equal(shouldRecoverGameRouteToLobby('/game', pendingRateLimit.status), false);

  const live = applyLiveShellState(createPendingShellSyncView(), makeShell());
  const rateLimitedWhileLive = applyShellSyncResponse({
    requestGeneration: live.generation,
    current: live,
    response: {
      success: false,
      code: 'RATE_LIMITED',
      message: SYSTEM_COPY.rateLimited,
    },
  });
  assert.equal(rateLimitedWhileLive.status, 'ready');
  assert.equal(rateLimitedWhileLive.state?.shellId, 'shell-a');
  assert.equal(shouldRecoverGameRouteToLobby('/game', rateLimitedWhileLive.status), false);
});

test('8. reconnect while game exists stays on /game', () => {
  const view = sync(createPendingShellSyncView(), {
    success: true,
    state: makeShell({ phase: 'PLAYING' }),
  });
  assert.equal(view.status, 'ready');
  assert.equal(view.state?.phase, 'PLAYING');
  assert.deepEqual(
    planNullShellLobbyRecovery({
      pathname: '/game',
      syncStatus: view.status,
      roomCode: ROOM_CODE,
    }),
    { recover: false },
  );
});

test('9. reconnect during Round Results while shell exists stays in results', () => {
  const view = sync(createPendingShellSyncView(), {
    success: true,
    state: makeShell({ phase: 'PLAYING', gameId: 'fast-answer' }),
  });
  assert.equal(view.status, 'ready');
  assert.equal(view.state?.phase, 'PLAYING');
  assert.equal(shouldRecoverGameRouteToLobby('/game', view.status), false);
});

test('10. shell gone after Final Results recovers to Lobby', () => {
  const finishedThenGone = sync(
    applyLiveShellState(createPendingShellSyncView(), makeShell({ phase: 'FINISHED' })),
    { success: true, state: null },
  );
  assert.equal(finishedThenGone.status, 'empty');
  const plan = planNullShellLobbyRecovery({
    pathname: '/game',
    syncStatus: finishedThenGone.status,
    roomCode: ROOM_CODE,
  });
  assert.equal(plan.recover, true);
});

test('11. Lobby recovery happens once — no redirect loop', () => {
  const empty = sync(createPendingShellSyncView(), { success: true, state: null });
  const onGame = planNullShellLobbyRecovery({
    pathname: '/game',
    syncStatus: empty.status,
    roomCode: ROOM_CODE,
  });
  const onLobby = planNullShellLobbyRecovery({
    pathname: '/lobby',
    syncStatus: empty.status,
    roomCode: ROOM_CODE,
  });
  assert.equal(onGame.recover, true);
  assert.equal(onLobby.recover, false);

  const page = read('app/(room)/game/game-page-client.tsx');
  assert.match(page, /recoveredRef/);
  assert.match(page, /recoveredRef\.current = true/);

  const roomContext = read('contexts/room-context.tsx');
  assert.match(
    roomContext,
    /response\.success &&\s*response\.data\.state &&\s*response\.data\.state\.phase !== 'FINISHED'/,
  );

  const lobby = read('components/lobby/lobby-screen.tsx');
  assert.match(lobby, /sessionStorage\.getItem\(LOBBY_NOTICE_STORAGE_KEY\)/);
  assert.match(lobby, /sessionStorage\.removeItem\(LOBBY_NOTICE_STORAGE_KEY\)/);
});

test('12. Game A null recovery cannot override a newer Game B shell', () => {
  const started = beginShellSync(createPendingShellSyncView());
  const gameB = applyLiveShellState(started.view, makeShell({ shellId: 'shell-b', gameId: 'judge' }));
  const staleNull = applyShellSyncResponse({
    requestGeneration: started.requestGeneration,
    current: gameB,
    response: { success: true, state: null },
  });
  assert.equal(staleNull.status, 'ready');
  assert.equal(staleNull.state?.shellId, 'shell-b');
  assert.equal(staleNull.generation, gameB.generation);
  assert.deepEqual(
    planNullShellLobbyRecovery({
      pathname: '/game',
      syncStatus: staleNull.status,
      roomCode: ROOM_CODE,
    }),
    { recover: false },
  );

  const recoveredThenB = applyLiveShellState(
    sync(createPendingShellSyncView(), { success: true, state: null }),
    makeShell({ shellId: 'shell-b', gameId: 'judge' }),
  );
  assert.equal(recoveredThenB.status, 'ready');
  assert.equal(recoveredThenB.state?.gameId, 'judge');
  assert.equal(shouldRecoverGameRouteToLobby('/game', recoveredThenB.status), false);
});

test('GameShellScreen treats pending as loading and empty as returning to Lobby', () => {
  const screen = read('components/game-shell/game-shell-screen.tsx');
  assert.match(screen, /syncStatus !== 'ready' \|\| !state/);
  assert.match(screen, /syncStatus === 'empty'/);
  assert.match(screen, /SYSTEM_COPY\.returningToLobby/);
  assert.match(screen, /SYSTEM_COPY\.loading/);
  assert.doesNotMatch(screen, /state === null/);
});

test('Lobby notice is informational, not a fatal crash error', () => {
  const banner = read('components/lobby/lobby-error-banner.tsx');
  assert.match(banner, /SYSTEM_COPY\.gameEndedReturnLobby/);
  assert.match(banner, /tone=\{isGameEndedNotice \? 'info' : 'error'\}/);

  const presented = read('lib/ui/system-copy.ts');
  assert.match(presented, /gameEndedReturnLobby: 'انتهت الجولة أو تمت إعادة تشغيل اللعبة، ورجعناك إلى اللوبي\.'/);
});

test('server null-shell contract remains success + state null', () => {
  const service = readFileSync(
    join(root, '../server/src/modules/game/game.service.ts'),
    'utf8',
  );
  assert.match(
    service,
    /export async function syncGameShell\([\s\S]*?if \(!shell\) \{\s*return \{\s*success: true,\s*data: \{ state: null \},/,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
