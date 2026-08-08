/**
 * Unit tests for reconnect credential localStorage helpers.
 * Run: node ../server/node_modules/tsx/dist/cli.mjs tests/reconnect-credential.test.ts
 */
import assert from 'node:assert/strict';
import {
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

const storage = new MemoryStorage();
(globalThis as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: storage as unknown as Storage,
};

test('credential round-trip by room code', () => {
  saveRoomReconnectCredential({
    playerId: 'p1',
    roomId: 'r1',
    roomCode: '123456',
    reconnectToken: 'token-abc',
  });
  const read = readRoomReconnectCredential('123456');
  assert.deepEqual(read, {
    playerId: 'p1',
    roomId: 'r1',
    roomCode: '123456',
    reconnectToken: 'token-abc',
  });
  removeRoomReconnectCredential('123456');
  assert.equal(readRoomReconnectCredential('123456'), null);
});

test('credential wins over typed join name', () => {
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
  assert.equal(intent.type, 'reconnect');
  if (intent.type === 'reconnect') {
    assert.equal(intent.playerId, 'p1');
    assert.equal(intent.reconnectToken, 'token-abc');
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
