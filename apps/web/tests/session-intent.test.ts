/**
 * Unit tests for room entry intent resolution and lobby URL normalization.
 * Run: pnpm --filter @wanasatna/server exec tsx ../web/tests/session-intent.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildLobbyUrl,
  lobbyUrlNeedsNormalization,
  resolveRoomEntryIntent,
  type RoomSession,
} from '../lib/room/session';
import { saveRoomReconnectCredential } from '../lib/room/reconnect-credential';

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

const storage = new MemoryStorage();
(globalThis as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: storage as unknown as Storage,
};

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

function params(entries: Record<string, string>): URLSearchParams {
  return new URLSearchParams(entries);
}

const session: RoomSession = {
  playerId: 'player-1',
  roomId: 'room-1',
  playerName: 'خالد',
  roomCode: '318429',
};

const credential = {
  playerId: 'player-1',
  roomId: 'room-1',
  roomCode: '318429',
  reconnectToken: 'token-abc',
};

test('explicit create overrides stored session', () => {
  const intent = resolveRoomEntryIntent(params({ action: 'create', name: 'محمد' }), session);
  assert.deepEqual(intent, { type: 'create', playerName: 'محمد' });
});

test('stored credential matching URL code wins over join', () => {
  saveRoomReconnectCredential(credential);
  const intent = resolveRoomEntryIntent(params({ code: '318429', name: 'خالد' }), session);
  assert.equal(intent.type, 'reconnect');
});

test('join intent used for a different room code', () => {
  const intent = resolveRoomEntryIntent(params({ code: '999999', name: 'خالد' }), session);
  assert.deepEqual(intent, { type: 'join', roomCode: '999999', playerName: 'خالد' });
});

test('join intent used when no stored session or credential', () => {
  storage.removeItem('wanasatna:reconnect:318429');
  const intent = resolveRoomEntryIntent(params({ code: '318429', name: 'خالد' }), null);
  assert.deepEqual(intent, { type: 'join', roomCode: '318429', playerName: 'خالد' });
});

test('code-only URL reconnects with stored credential', () => {
  saveRoomReconnectCredential(credential);
  const intent = resolveRoomEntryIntent(params({ code: '318429' }), null);
  assert.equal(intent.type, 'reconnect');
});

test('no params and no session resolves to none', () => {
  const intent = resolveRoomEntryIntent(params({}), null);
  assert.deepEqual(intent, { type: 'none' });
});

test('URL normalization strips name and action after success', () => {
  assert.equal(lobbyUrlNeedsNormalization(params({ code: '318429', name: 'خالد' }), '318429'), true);
  assert.equal(
    lobbyUrlNeedsNormalization(params({ action: 'create', name: 'محمد' }), '318429'),
    true,
  );
  assert.equal(lobbyUrlNeedsNormalization(params({ code: '318429' }), '318429'), false);
  assert.equal(lobbyUrlNeedsNormalization(params({ code: '111111' }), '318429'), true);
  assert.equal(buildLobbyUrl('318429'), '/lobby?code=318429');
});

test('sticky create URL still resolves to create and would override stored session', () => {
  // Documents the production race: if action=create remains after success,
  // resolveRoomEntryIntent prefers create over the stored session. applyRoomSession
  // must sync the URL synchronously so transport resume never sees this intent.
  saveRoomReconnectCredential(credential);
  const intent = resolveRoomEntryIntent(
    params({ action: 'create', name: 'محمد' }),
    session,
  );
  assert.deepEqual(intent, { type: 'create', playerName: 'محمد' });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
