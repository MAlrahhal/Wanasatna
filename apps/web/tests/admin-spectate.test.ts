/**
 * Admin Spectate UI contracts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_NAV_LINKS } from '../lib/public/routes';
import { ADMIN_COPY, ADMIN_AUDIT_ACTION_LABEL } from '../lib/admin/copy';
import { ADMIN_ROUTES, adminRoomPath, adminRoomSpectatePath } from '../lib/admin/routes';

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

test('spectate route and live-room CTA exist', () => {
  assert.equal(adminRoomSpectatePath('abc'), '/admin/rooms/abc/spectate');
  assert.equal(existsSync(join(root, 'app/admin/rooms/[roomId]/spectate/page.tsx')), true);
  assert.equal(ADMIN_COPY.spectateLive, 'مشاهدة مباشرة');
  assert.equal(ADMIN_COPY.spectateBanner, 'وضع المشاهدة — مسؤول');
  assert.equal(ADMIN_COPY.spectateReadOnly.includes('للقراءة فقط'), true);
  assert.equal(ADMIN_AUDIT_ACTION_LABEL.ROOM_SPECTATE, 'مشاهدة مباشرة');
  assert.equal(JSON.stringify(PUBLIC_NAV_LINKS).includes('/spectate'), false);
  assert.equal(adminRoomPath('abc'), '/admin/rooms/abc');
});

test('client uses isolated admin socket and read-only events only', () => {
  const client = read('components/admin/admin-spectate-client.tsx');
  const socket = read('lib/admin/spectate-socket.ts');
  assert.match(socket, /createAdminSpectateSocket/);
  assert.doesNotMatch(socket, /getRoomSocket|RoomSessionManager|join-room/);
  assert.match(client, /createAdminSpectateSocket/);
  assert.match(client, /ADMIN_SPECTATE_JOIN_EVENT/);
  assert.match(client, /ADMIN_SPECTATE_SYNC_EVENT/);
  assert.match(client, /ADMIN_SPECTATE_LEAVE_EVENT/);
  assert.match(client, /ADMIN_COPY\.spectateBanner/);
  assert.match(client, /ADMIN_COPY\.spectateReadOnly/);
  assert.match(client, /ADMIN_COPY\.spectateClosed/);
  assert.match(client, /ROOM_CLOSED_EVENT/);
  assert.match(client, /pointer-events-none/);
  assert.match(client, /readOnly/);
  assert.doesNotMatch(client, /getRoomSocket|join-room|game-shell-set-ready|room-chat-send/);
  assert.doesNotMatch(
    client,
    /passwordHash|tokenHash|encryptedSecret|ipAddress|reconnectToken|ADMIN_EMAILS/i,
  );
});

test('live rooms expose spectate without treating history as live', () => {
  const list = read('components/admin/admin-rooms-client.tsx');
  const detail = read('components/admin/admin-room-detail-client.tsx');
  const history = read('components/admin/admin-room-history-client.tsx');
  assert.match(list, /adminRoomSpectatePath/);
  assert.match(list, /ADMIN_COPY\.spectateLive/);
  assert.match(detail, /adminRoomSpectatePath/);
  assert.match(detail, /ADMIN_COPY\.spectateLive/);
  assert.doesNotMatch(history, /adminRoomSpectatePath|spectateLive/);
  assert.equal(ADMIN_ROUTES.roomHistory.includes('spectate'), false);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
