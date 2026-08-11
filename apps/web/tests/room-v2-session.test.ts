/**
 * Room Client Core V2 — session storage + stale generation unit tests.
 * Run: pnpm --filter @wanasatna/web exec tsx tests/room-v2-session.test.ts
 */
import assert from 'node:assert/strict';
import {
  ACTIVE_ROOM_SESSION_KEY,
  clearPersistedActiveRoomSession,
  purgeLegacyRoomStorage,
  readPersistedActiveRoomSession,
  writePersistedActiveRoomSession,
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

test('manager reset helper exists', () => {
  __resetRoomSessionManagerForTests();
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
