/**
 * Unit tests for reconnect credential sessionStorage helpers.
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/reconnect-credential.test.ts
 */
import assert from 'node:assert/strict';
import {
  ACTIVE_ROOM_RESUME_STORAGE_KEY,
  LEGACY_RECONNECT_KEY_PREFIX,
  purgeLegacyLocalStorageRoomIdentity,
  readRoomReconnectCredential,
  removeRoomReconnectCredential,
  saveRoomReconnectCredential,
} from '../lib/room/reconnect-credential';
import { resolveRoomEntryIntent } from '../lib/room/session';

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

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  clear(): void {
    this.store.clear();
  }
}

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

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();

(globalThis as unknown as {
  window: { localStorage: Storage; sessionStorage: Storage };
}).window = {
  localStorage: localStorage as unknown as Storage,
  sessionStorage: sessionStorage as unknown as Storage,
};

test('credential round-trip in sessionStorage (single active resume)', () => {
  sessionStorage.clear();
  localStorage.clear();

  saveRoomReconnectCredential({
    playerId: 'p1',
    roomId: 'r1',
    roomCode: '123456',
    reconnectToken: 'token-abc',
  });

  assert.ok(sessionStorage.getItem(ACTIVE_ROOM_RESUME_STORAGE_KEY));
  assert.deepEqual(readRoomReconnectCredential('123456'), {
    playerId: 'p1',
    roomId: 'r1',
    roomCode: '123456',
    reconnectToken: 'token-abc',
  });
  assert.equal(readRoomReconnectCredential('999999'), null);

  removeRoomReconnectCredential('123456');
  assert.equal(readRoomReconnectCredential('123456'), null);
});

test('saving a new resume replaces the previous room resume', () => {
  sessionStorage.clear();
  saveRoomReconnectCredential({
    playerId: 'p1',
    roomId: 'r1',
    roomCode: '111111',
    reconnectToken: 't1',
  });
  saveRoomReconnectCredential({
    playerId: 'p2',
    roomId: 'r2',
    roomCode: '222222',
    reconnectToken: 't2',
  });
  assert.equal(readRoomReconnectCredential('111111'), null);
  assert.equal(readRoomReconnectCredential('222222')?.playerId, 'p2');
});

test('legacy localStorage reconnect keys are purged and cannot win over typed join', () => {
  sessionStorage.clear();
  localStorage.clear();
  localStorage.setItem(
    `${LEGACY_RECONNECT_KEY_PREFIX}318429`,
    JSON.stringify({
      playerId: 'legacy',
      roomId: 'r-legacy',
      roomCode: '318429',
      reconnectToken: 'legacy-token',
    }),
  );

  purgeLegacyLocalStorageRoomIdentity();
  assert.equal(localStorage.getItem(`${LEGACY_RECONNECT_KEY_PREFIX}318429`), null);

  const intent = resolveRoomEntryIntent(
    new URLSearchParams({ code: '318429', name: 'عبدالله' }),
    null,
  );
  assert.equal(intent.type, 'join');
  if (intent.type === 'join') {
    assert.equal(intent.playerName, 'عبدالله');
  }
});

test('typed join name always wins over active resume credential', () => {
  sessionStorage.clear();
  saveRoomReconnectCredential({
    playerId: 'p1',
    roomId: 'r1',
    roomCode: '318429',
    reconnectToken: 'token-abc',
  });
  const intent = resolveRoomEntryIntent(
    new URLSearchParams({ code: '318429', name: 'خالد' }),
    null,
  );
  assert.equal(intent.type, 'join');
  if (intent.type === 'join') {
    assert.equal(intent.playerName, 'خالد');
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
