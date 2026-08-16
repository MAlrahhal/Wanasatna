/**
 * P12-B.5 web contracts: cookie-backed socket identity, no client-sent userId.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    console.error(error instanceof Error ? error.message : error);
  }
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

test('room socket sends the httpOnly cookie and never a client auth token', () => {
  const socket = read('lib/room/socket.ts');
  assert.match(socket, /withCredentials:\s*true/);
  assert.doesNotMatch(socket, /auth:\s*\{|localStorage|sessionStorage|jwt|bearer/i);
});

test('Create/Join payloads stay name/code only', () => {
  const manager = read('lib/room-v2/manager.ts');
  assert.match(manager, /CREATE_ROOM_EVENT,\s*\{\s*playerName\s*\}/);
  assert.match(manager, /JOIN_ROOM_EVENT,\s*\{\s*roomCode,\s*playerName,/);
  assert.doesNotMatch(manager, /userId/);
});

test('login/logout refresh idle socket only; Room reconnect identity is untouched', () => {
  const refresh = read('lib/auth/refresh-idle-socket.ts');
  const auth = read('contexts/auth-context.tsx');
  assert.match(auth, /refreshIdleRoomSocketForAccountAuth/);
  assert.match(refresh, /BUSY_ROOM_STATUSES/);
  assert.match(refresh, /disconnectRoomSocket/);
  assert.doesNotMatch(refresh, /leaveRoom|removeRoomReconnectCredential|reconnectToken/);
  assert.doesNotMatch(auth, /leaveRoom|removeRoomReconnectCredential/);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
