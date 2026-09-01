/** Admin Batch 2 — Live Rooms and durable Room History UI contracts. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_LIVE_ROOMS_PAGE_SIZE, ADMIN_ROOM_HISTORY_PAGE_SIZE } from '@wanasatna/shared';
import { ADMIN_COPY } from '../lib/admin/copy';
import { ADMIN_NAV_ITEMS, ADMIN_ROUTES, adminRoomHistoryPath } from '../lib/admin/routes';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  }
}

test('Admin navigation clearly separates Live Rooms, Room History, and Match History', () => {
  assert.equal(ADMIN_ROUTES.rooms, '/admin/rooms');
  assert.equal(ADMIN_ROUTES.roomHistory, '/admin/room-history');
  assert.equal(ADMIN_ROUTES.history, '/admin/history');
  assert.equal(adminRoomHistoryPath('history-1'), '/admin/room-history/history-1');
  assert.equal(ADMIN_NAV_ITEMS.find((item) => item.id === 'rooms')?.label, 'الغرف المباشرة');
  assert.equal(ADMIN_NAV_ITEMS.find((item) => item.id === 'roomHistory')?.label, 'سجل الغرف');
  assert.equal(ADMIN_NAV_ITEMS.find((item) => item.id === 'log')?.label, 'سجل المباريات');
});

test('Live Rooms UI uses URL filters, server pagination, polling, and safe summaries', () => {
  const source = read('components/admin/admin-rooms-client.tsx');
  assert.equal(ADMIN_LIVE_ROOMS_PAGE_SIZE, 25);
  assert.match(source, /useSearchParams/);
  assert.match(source, /q: query/);
  assert.match(source, /locked: locked/);
  assert.match(source, /page,/);
  assert.match(source, /ADMIN_DASHBOARD_POLL_MS/);
  assert.match(source, /room\.playerCount[\s\S]*room\.playerCap/);
  assert.match(source, /room\.hostDisplayName/);
  assert.match(source, /RoomStatusBadge/);
  assert.match(source, /ADMIN_COPY\.emptyRooms/);
  assert.doesNotMatch(source, /room\.players\.map/);
});

test('Room History list has URL-driven filters, deterministic pagination controls, and partial badges', () => {
  const page = 'app/admin/room-history/page.tsx';
  const source = read('components/admin/admin-room-history-client.tsx');
  assert.equal(existsSync(join(root, page)), true);
  assert.equal(ADMIN_ROOM_HISTORY_PAGE_SIZE, 25);
  for (const token of [
    'roomCode',
    'participant',
    'host',
    'gameId',
    'createdFrom',
    'createdTo',
    'state',
  ]) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /useSearchParams/);
  assert.match(source, /ADMIN_COPY\.partialHistory/);
  assert.match(source, /ADMIN_COPY\.emptyRoomHistory/);
  assert.match(source, /ADMIN_COPY\.previousPage/);
  assert.match(source, /ADMIN_COPY\.nextPage/);
});

test('Room History detail shows coverage, hosts, participants, Match links, and empty states', () => {
  const page = 'app/admin/room-history/[historyId]/page.tsx';
  const source = read('components/admin/admin-room-history-detail-client.tsx');
  assert.equal(existsSync(join(root, page)), true);
  assert.match(source, /partialHistoryNote/);
  assert.match(source, /hostAssignments\.map/);
  assert.match(source, /participants\.map/);
  assert.match(source, /joinedAsSpectator/);
  assert.match(source, /wasHost/);
  assert.match(source, /matches\.map/);
  assert.match(source, /adminHistoryPath/);
  assert.match(source, /winnerDisplayNames/);
  assert.match(source, /noHostAssignments/);
  assert.match(source, /noParticipants/);
  assert.match(source, /noRoomMatches/);
  assert.match(source, /roomHistoryMissing/);
});

test('Admin clients keep a strict safe-field boundary and add no Spectate action', () => {
  const files = [
    'lib/admin/api.ts',
    'components/admin/admin-rooms-client.tsx',
    'components/admin/admin-room-history-client.tsx',
    'components/admin/admin-room-history-detail-client.tsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /reconnectToken|passwordHash|encryptedSecret|recoveryCode|ipAddress|socketId|ADMIN_EMAILS/i,
    );
    assert.doesNotMatch(source, /adminSpectate|spectateAdminRoom|\/spectate/i);
  }
});

test('Live detail links to durable history without replacing authoritative live controls', () => {
  const source = read('components/admin/admin-room-detail-client.tsx');
  assert.match(source, /adminRoomHistoryPath\(room\.historyId\)/);
  assert.match(source, /room\.status === 'PLAYING'/);
  assert.match(source, /lockAdminRoom/);
  assert.match(source, /kickAdminPlayer/);
  assert.match(source, /forceCloseAdminRoom/);
});

assert.equal(ADMIN_COPY.roomHistoryTitle, 'سجل الغرف');
assert.equal(ADMIN_COPY.historyTitle, 'سجل المباريات');

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
