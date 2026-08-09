/**
 * Explicit leave must invalidate reconnect identity so the next join is fresh.
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/explicit-leave-identity.test.ts
 */
import assert from 'node:assert/strict';
import {
  readRoomReconnectCredential,
  removeRoomReconnectCredential,
  saveRoomReconnectCredential,
} from '../lib/room/reconnect-credential';
import {
  beginNewRoomIdentity,
  resolveRoomEntryIntent,
  writeRoomSession,
  type RoomSession,
} from '../lib/room/session';

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

function seedIdentity(session: RoomSession, token: string): void {
  writeRoomSession(session);
  saveRoomReconnectCredential({
    playerId: session.playerId,
    roomId: session.roomId,
    roomCode: session.roomCode,
    reconnectToken: token,
  });
}

test('explicit leave without roomCode arg still clears reconnect credential', () => {
  localStorage.clear();
  sessionStorage.clear();

  seedIdentity(
    {
      playerId: 'khaled-id',
      roomId: 'room-1',
      playerName: 'خالد',
      roomCode: '318429',
    },
    'token-khaled',
  );

  beginNewRoomIdentity();

  assert.equal(readRoomReconnectCredential('318429'), null);

  const intent = resolveRoomEntryIntent(
    new URLSearchParams({ code: '318429', name: 'عبدالله' }),
    null,
  );
  assert.equal(intent.type, 'join');
  if (intent.type === 'join') {
    assert.equal(intent.playerName, 'عبدالله');
  }
});

test('خالد → leave → عبدالله → leave → سارة uses fresh join each time', () => {
  localStorage.clear();
  sessionStorage.clear();

  const roomCode = '554433';

  seedIdentity(
    {
      playerId: 'id-khaled',
      roomId: 'room-a',
      playerName: 'خالد',
      roomCode,
    },
    'token-1',
  );
  beginNewRoomIdentity(roomCode);
  assert.equal(readRoomReconnectCredential(roomCode), null);

  const joinAbdullah = resolveRoomEntryIntent(
    new URLSearchParams({ code: roomCode, name: 'عبدالله' }),
    null,
  );
  assert.equal(joinAbdullah.type, 'join');
  if (joinAbdullah.type === 'join') {
    assert.equal(joinAbdullah.playerName, 'عبدالله');
  }

  seedIdentity(
    {
      playerId: 'id-abdullah',
      roomId: 'room-a',
      playerName: 'عبدالله',
      roomCode,
    },
    'token-2',
  );
  beginNewRoomIdentity();
  assert.equal(readRoomReconnectCredential(roomCode), null);
  assert.notEqual('id-khaled', 'id-abdullah');

  const joinSara = resolveRoomEntryIntent(
    new URLSearchParams({ code: roomCode, name: 'سارة' }),
    null,
  );
  assert.equal(joinSara.type, 'join');
  if (joinSara.type === 'join') {
    assert.equal(joinSara.playerName, 'سارة');
  }
});

test('refresh/disconnect path still prefers reconnect credential', () => {
  localStorage.clear();
  sessionStorage.clear();

  saveRoomReconnectCredential({
    playerId: 'id-khaled',
    roomId: 'room-a',
    roomCode: '318429',
    reconnectToken: 'token-alive',
  });

  const intent = resolveRoomEntryIntent(
    new URLSearchParams({ code: '318429', name: 'عبدالله' }),
    null,
  );
  assert.equal(intent.type, 'reconnect');
  if (intent.type === 'reconnect') {
    assert.equal(intent.playerId, 'id-khaled');
  }

  removeRoomReconnectCredential('318429');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
