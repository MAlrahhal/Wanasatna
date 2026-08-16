/**
 * Room Client Core V2 — session storage + stale generation unit tests.
 * Run: pnpm --filter @wanasatna/web exec tsx tests/room-v2-session.test.ts
 */
import assert from 'node:assert/strict';
import {
  ACTIVE_ROOM_SESSION_KEY,
  RECONNECT_CLAIMS_STORAGE_KEY,
  canAutoResumeWithExplicitName,
  clearPersistedActiveRoomSession,
  getRoomSessionManager,
  isTerminalResumeFailure,
  purgeLegacyRoomStorage,
  readPersistedActiveRoomSession,
  readReconnectClaim,
  removeReconnectClaim,
  removeReconnectClaimForSession,
  resolveExplicitJoinIntent,
  selectExplicitJoinReconnectIdentity,
  writePersistedActiveRoomSession,
  writeReconnectClaim,
  type ActiveRoomSession,
  __resetRoomSessionManagerForTests,
} from '../lib/room-v2/index';

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
  key(i: number): string | null {
    return [...this.store.keys()][i] ?? null;
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();

(globalThis as unknown as { window: { localStorage: Storage; sessionStorage: Storage } }).window = {
  localStorage: localStorage as unknown as Storage,
  sessionStorage: sessionStorage as unknown as Storage,
};

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): void {
  try {
    const result = fn();
    if (result && typeof (result as Promise<void>).then === 'function') {
      throw new Error('async tests not supported in this runner');
    }
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

const sample: ActiveRoomSession = {
  roomId: 'room-1',
  roomCode: '123456',
  playerId: 'player-1',
  playerName: 'خلود',
  reconnectToken: 'token-1',
};

test('ActiveRoomSession save/load', () => {
  sessionStorage.clear();
  writePersistedActiveRoomSession(sample);
  assert.deepEqual(readPersistedActiveRoomSession(), sample);
});

test('clear session', () => {
  writePersistedActiveRoomSession(sample);
  clearPersistedActiveRoomSession();
  assert.equal(readPersistedActiveRoomSession(), null);
  assert.equal(sessionStorage.getItem(ACTIVE_ROOM_SESSION_KEY), null);
});

test('legacy key purge', () => {
  sessionStorage.setItem('wanasatna:playerId', 'legacy');
  sessionStorage.setItem('wanasatna:active-room-resume', '{}');
  localStorage.setItem('wanasatna:reconnect:111111', '{}');
  writePersistedActiveRoomSession(sample);
  purgeLegacyRoomStorage();
  assert.equal(sessionStorage.getItem('wanasatna:playerId'), null);
  assert.equal(sessionStorage.getItem('wanasatna:active-room-resume'), null);
  assert.equal(localStorage.getItem('wanasatna:reconnect:111111'), null);
  assert.ok(readPersistedActiveRoomSession());
});

test('write session also purges legacy', () => {
  localStorage.setItem('wanasatna:reconnect:999999', '{}');
  writePersistedActiveRoomSession(sample);
  assert.equal(localStorage.getItem('wanasatna:reconnect:999999'), null);
});

test('invalid persisted JSON yields null', () => {
  sessionStorage.setItem(ACTIVE_ROOM_SESSION_KEY, '{"roomId":1}');
  assert.equal(readPersistedActiveRoomSession(), null);
});

test('legacy purge never deletes V2 active-room-session', () => {
  sessionStorage.clear();
  writePersistedActiveRoomSession(sample);
  sessionStorage.setItem('wanasatna:playerId', 'legacy');
  purgeLegacyRoomStorage();
  assert.deepEqual(readPersistedActiveRoomSession(), sample);
  assert.equal(sessionStorage.getItem('wanasatna:playerId'), null);
});

test('manager rehydrate + subscribe delivers current session immediately', () => {
  __resetRoomSessionManagerForTests();
  sessionStorage.clear();
  writePersistedActiveRoomSession(sample);

  const manager = getRoomSessionManager();
  manager.rehydrateFromStorageIfNeeded();

  let seen: string | null = null;
  const unsub = manager.subscribe((state) => {
    seen = state.session?.playerName ?? null;
  });
  assert.equal(seen, 'خلود');
  assert.equal(manager.getState().session?.roomCode, '123456');
  unsub();
  __resetRoomSessionManagerForTests();
});

test('globalThis manager singleton is stable across getRoomSessionManager calls', () => {
  __resetRoomSessionManagerForTests();
  const a = getRoomSessionManager();
  const b = getRoomSessionManager();
  assert.equal(a, b);
  __resetRoomSessionManagerForTests();
});

test('same room + same name + token → reconnect, not join', () => {
  assert.equal(resolveExplicitJoinIntent(sample, '123456', 'خلود'), 'reconnect');
  assert.equal(resolveExplicitJoinIntent(sample, '123-456', '  خلود  '), 'reconnect');
});

test('same room + different name → join, old token unused', () => {
  assert.equal(resolveExplicitJoinIntent(sample, '123456', 'عبدالله'), 'join');
});

test('different room → join even with same name', () => {
  assert.equal(resolveExplicitJoinIntent(sample, '999999', 'خلود'), 'join');
});

test('missing token or playerId cannot reconnect via join form', () => {
  assert.equal(
    resolveExplicitJoinIntent({ ...sample, reconnectToken: '' }, '123456', 'خلود'),
    'join',
  );
  assert.equal(resolveExplicitJoinIntent(null, '123456', 'خلود'), 'join');
});

test('code-only refresh may resume without retyping name', () => {
  assert.equal(canAutoResumeWithExplicitName(sample, ''), true);
  assert.equal(canAutoResumeWithExplicitName(sample, null), true);
  assert.equal(canAutoResumeWithExplicitName(sample, 'خلود'), true);
});

test('explicit URL name=B must not silently resume stored name A', () => {
  assert.equal(canAutoResumeWithExplicitName(sample, 'عبدالله'), false);
  assert.equal(canAutoResumeWithExplicitName(null, 'عبدالله'), false);
});

test('terminal reconnect failures discard stale session; transport failures do not', () => {
  assert.equal(isTerminalResumeFailure('PLAYER_NOT_FOUND'), true);
  assert.equal(isTerminalResumeFailure('RECONNECT_EXPIRED'), true);
  assert.equal(isTerminalResumeFailure('RECONNECT_INVALID_TOKEN'), true);
  assert.equal(isTerminalResumeFailure('ROOM_NOT_FOUND'), true);
  assert.equal(isTerminalResumeFailure('ROOM_CLOSED'), true);
  assert.equal(isTerminalResumeFailure('CONNECTION_FAILED'), false);
});

const other: ActiveRoomSession = {
  roomId: 'room-2',
  roomCode: '654321',
  playerId: 'player-2',
  playerName: 'محمد',
  reconnectToken: 'token-2',
};

test('successful session write creates persistent reconnect claim', () => {
  sessionStorage.clear();
  localStorage.clear();
  writePersistedActiveRoomSession(sample);
  assert.deepEqual(readReconnectClaim('123456', 'خلود'), sample);
});

test('simulated tab close keeps local claim after sessionStorage is gone', () => {
  sessionStorage.clear();
  localStorage.clear();
  writePersistedActiveRoomSession(sample);
  sessionStorage.removeItem(ACTIVE_ROOM_SESSION_KEY);
  assert.equal(readPersistedActiveRoomSession(), null);
  assert.deepEqual(readReconnectClaim('123456', 'خلود'), sample);
});

test('reopen same browser: same room + same name selects claim for reconnect', () => {
  sessionStorage.clear();
  localStorage.clear();
  writeReconnectClaim(sample);
  const identity = selectExplicitJoinReconnectIdentity(null, readReconnectClaim('123456', 'خلود'), '123456', 'خلود');
  assert.ok(identity);
  assert.equal(identity?.playerId, 'player-1');
  assert.equal(resolveExplicitJoinIntent(identity, '123456', 'خلود'), 'reconnect');
});

test('same room + different name ignores old claim and JOINs', () => {
  sessionStorage.clear();
  localStorage.clear();
  writeReconnectClaim(sample);
  const identity = selectExplicitJoinReconnectIdentity(
    null,
    readReconnectClaim('123456', 'عبدالله'),
    '123456',
    'عبدالله',
  );
  assert.equal(identity, null);
  assert.equal(resolveExplicitJoinIntent(sample, '123456', 'عبدالله'), 'join');
});

test('different room ignores old claim and JOINs', () => {
  sessionStorage.clear();
  localStorage.clear();
  writeReconnectClaim(sample);
  const identity = selectExplicitJoinReconnectIdentity(
    null,
    readReconnectClaim('999999', 'خلود'),
    '999999',
    'خلود',
  );
  assert.equal(identity, null);
  assert.equal(resolveExplicitJoinIntent(sample, '999999', 'خلود'), 'join');
});

test('no claim cannot reclaim a name — JOIN only', () => {
  sessionStorage.clear();
  localStorage.clear();
  assert.equal(selectExplicitJoinReconnectIdentity(null, null, '123456', 'خلود'), null);
  assert.equal(resolveExplicitJoinIntent(null, '123456', 'خلود'), 'join');
});

test('explicit leave removes matching claim only', () => {
  sessionStorage.clear();
  localStorage.clear();
  writeReconnectClaim(sample);
  writeReconnectClaim(other);
  removeReconnectClaimForSession(sample);
  assert.equal(readReconnectClaim('123456', 'خلود'), null);
  assert.deepEqual(readReconnectClaim('654321', 'محمد'), other);
});

test('kick removes matching claim', () => {
  sessionStorage.clear();
  localStorage.clear();
  writeReconnectClaim(sample);
  removeReconnectClaimForSession(sample);
  assert.equal(readReconnectClaim('123456', 'خلود'), null);
});

test('expired credential removes stale claim and cannot loop reconnect', () => {
  sessionStorage.clear();
  localStorage.clear();
  writePersistedActiveRoomSession(sample);
  assert.equal(isTerminalResumeFailure('RECONNECT_EXPIRED'), true);
  removeReconnectClaimForSession(sample);
  clearPersistedActiveRoomSession();
  assert.equal(readReconnectClaim('123456', 'خلود'), null);
  assert.equal(readPersistedActiveRoomSession(), null);
  assert.equal(selectExplicitJoinReconnectIdentity(null, readReconnectClaim('123456', 'خلود'), '123456', 'خلود'), null);
});

test('temporary reconnect timeout does not destroy claim', () => {
  sessionStorage.clear();
  localStorage.clear();
  writePersistedActiveRoomSession(sample);
  assert.equal(isTerminalResumeFailure('CONNECTION_FAILED'), false);
  assert.deepEqual(readReconnectClaim('123456', 'خلود'), sample);
});

test('multiple claims: clearing A does not remove B', () => {
  sessionStorage.clear();
  localStorage.clear();
  writeReconnectClaim(sample);
  writeReconnectClaim(other);
  removeReconnectClaim('123456', 'خلود');
  assert.equal(readReconnectClaim('123456', 'خلود'), null);
  assert.deepEqual(readReconnectClaim('654321', 'محمد'), other);
});

test('refresh sessionStorage resume is unchanged', () => {
  sessionStorage.clear();
  localStorage.clear();
  writePersistedActiveRoomSession(sample);
  assert.deepEqual(readPersistedActiveRoomSession(), sample);
  assert.equal(canAutoResumeWithExplicitName(readPersistedActiveRoomSession(), ''), true);
});

test('legacy purge does not delete v2 reconnect claims', () => {
  sessionStorage.clear();
  localStorage.clear();
  writeReconnectClaim(sample);
  localStorage.setItem('wanasatna:reconnect:123456', '{}');
  purgeLegacyRoomStorage();
  assert.equal(localStorage.getItem('wanasatna:reconnect:123456'), null);
  assert.ok(localStorage.getItem(RECONNECT_CLAIMS_STORAGE_KEY));
  assert.deepEqual(readReconnectClaim('123456', 'خلود'), sample);
});

test('incomplete claim is not persisted', () => {
  sessionStorage.clear();
  localStorage.clear();
  writeReconnectClaim({ ...sample, reconnectToken: '' });
  assert.equal(readReconnectClaim('123456', 'خلود'), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
