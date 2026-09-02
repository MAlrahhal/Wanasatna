/**
 * P13-C — Admin live Room management UI contracts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_DASHBOARD_POLL_MS, ADMIN_ROOM_CLOSED_MESSAGE } from '@wanasatna/shared';
import { ADMIN_COPY } from '../lib/admin/copy';
import { ADMIN_NAV_ITEMS, ADMIN_ROUTES, adminRoomPath } from '../lib/admin/routes';

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

test('rooms route is a real Admin view', () => {
  assert.equal(ADMIN_ROUTES.rooms, '/admin/rooms');
  assert.equal(adminRoomPath('abc'), '/admin/rooms/abc');
  assert.equal(existsSync(join(root, 'app/admin/rooms/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/admin/rooms/[roomId]/page.tsx')), true);
  assert.equal(existsSync(join(root, 'app/admin/rooms/[roomId]/spectate/page.tsx')), true);
  const roomsNav = ADMIN_NAV_ITEMS.find((item) => item.id === 'rooms');
  assert.ok(roomsNav);
  assert.equal(roomsNav.placeholder, false);
  assert.equal(roomsNav.href, ADMIN_ROUTES.rooms);
  assert.equal(ADMIN_COPY.roomsTitle, 'الغرف المباشرة');
  assert.equal(ADMIN_COPY.emptyRooms, 'لا توجد غرف نشطة حالياً');
});

test('rooms list and details reuse 12s poll and show Room fields', () => {
  const list = read('components/admin/admin-rooms-client.tsx');
  const detail = read('components/admin/admin-room-detail-client.tsx');
  assert.equal(ADMIN_DASHBOARD_POLL_MS >= 10_000, true);
  assert.equal(ADMIN_DASHBOARD_POLL_MS <= 15_000, true);
  assert.match(list, /ADMIN_DASHBOARD_POLL_MS/);
  assert.match(list, /inFlightRef\.current/);
  assert.match(list, /document\.hidden/);
  assert.match(list, /ADMIN_COPY\.emptyRooms/);
  assert.match(list, /adminRoomPath/);
  assert.match(detail, /ADMIN_DASHBOARD_POLL_MS/);
  assert.match(detail, /document\.hidden/);
  assert.match(detail, /ADMIN_COPY\.lockRoom/);
  assert.match(detail, /ADMIN_COPY\.unlockRoom/);
  assert.match(detail, /ADMIN_COPY\.kickPlayer/);
  assert.match(detail, /ADMIN_COPY\.closeRoom/);
  assert.match(detail, /ADMIN_COPY\.kickConfirm/);
  assert.match(detail, /سيتم إغلاق الغرفة \{room\.code\}/);
  assert.match(detail, /ADMIN_COPY\.closeConfirmCta/);
  assert.match(list, /ADMIN_COPY\.spectateLive/);
  assert.match(detail, /ADMIN_COPY\.spectateLive/);
  assert.match(list, /adminRoomSpectatePath/);
  assert.match(detail, /adminRoomSpectatePath/);
});

test('dangerous actions require confirmation; close copy includes Room code', () => {
  const detail = read('components/admin/admin-room-detail-client.tsx');
  assert.match(detail, /role="dialog"/);
  assert.match(detail, /kickTarget/);
  assert.match(detail, /closeOpen/);
  assert.match(detail, /forceCloseAdminRoom/);
  assert.match(detail, /kickAdminPlayer/);
  assert.equal(ADMIN_COPY.closeConfirmTitle, 'إغلاق الغرفة؟');
});

test('clients handle admin close reason and return home', () => {
  const manager = read('lib/room-v2/manager.ts');
  const lobby = read('components/lobby/lobby-screen.tsx');
  const game = read('app/(room)/game/game-page-client.tsx');
  const copy = read('lib/ui/system-copy.ts');
  assert.match(manager, /ROOM_CLOSED_EVENT/);
  assert.match(manager, /onTerminal\?\.\('closed'\)/);
  assert.match(lobby, /sessionEndReason === 'closed'/);
  assert.match(game, /sessionEndReason === 'closed'/);
  assert.match(copy, /ADMIN_ROOM_CLOSED_MESSAGE/);
  assert.equal(ADMIN_ROOM_CLOSED_MESSAGE, 'تم إغلاق الغرفة من الإدارة.');
  assert.equal(ADMIN_COPY.cancel, 'إلغاء');
});

test('no private account data, 20-player, or game settings in rooms UI', () => {
  const files = [
    'components/admin/admin-rooms-client.tsx',
    'components/admin/admin-room-detail-client.tsx',
    'app/admin/rooms/page.tsx',
    'app/admin/rooms/[roomId]/page.tsx',
    'app/admin/rooms/[roomId]/spectate/page.tsx',
  ];
  for (const file of files) {
    assert.doesNotMatch(
      read(file),
      /passwordHash|tokenHash|reconnectToken|ADMIN_EMAILS|userId|20-player|premium/i,
    );
  }
  const copy = read('lib/admin/copy.ts');
  assert.doesNotMatch(
    copy,
    /passwordHash|tokenHash|reconnectToken|ADMIN_EMAILS|20-player|premium/i,
  );
  const api = read('lib/admin/api.ts');
  assert.doesNotMatch(api, /passwordHash|tokenHash|reconnectToken|ADMIN_EMAILS|20-player|premium/i);
  const pickRoom = api.slice(
    api.indexOf('function pickSafeRoom'),
    api.indexOf('export type AdminRoomsResult'),
  );
  assert.doesNotMatch(pickRoom, /userId|role: record\.role/);
  const detail = read('components/admin/admin-room-detail-client.tsx');
  assert.doesNotMatch(detail, /gameTimer|countdownSeconds|enableGame|promote/);
});

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
