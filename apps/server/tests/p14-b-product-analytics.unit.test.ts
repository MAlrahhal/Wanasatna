/**
 * P14-B — server-authoritative product events (Room/platform only).
 * Run: pnpm --filter @wanasatna/server test:p14-b
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProductEventType } from '@prisma/client';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { adminForceCloseRoom } from '../src/modules/admin/admin-rooms.service.js';
import {
  recordProductEvent,
  setProductEventWriterForTests,
} from '../src/modules/analytics/product-event.service.js';
import { deleteGameShell, initGameShell } from '../src/modules/game/game.service.js';
import { completePersistedMatch } from '../src/modules/match/match-history.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import {
  handlePlayerDisconnect,
  leaveRoom,
} from '../src/modules/room/services/leave-room.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';
import { MAX_ROOM_PLAYERS } from '../src/modules/room/room.utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

function uniqueName(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 900 + 100)}`;
}

async function mustCreate(playerName: string) {
  const result = await createRoom({ playerName });
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function mustJoin(roomCode: string, playerName: string) {
  const result = await joinRoom({ roomCode, playerName });
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function eventsFor(roomId: string) {
  return prisma.productEvent.findMany({
    where: { roomId },
    orderBy: { createdAt: 'asc' },
  });
}

function typesOf(rows: { type: ProductEventType }[]): ProductEventType[] {
  return rows.map((row) => row.type);
}

async function cleanupRoom(roomId: string | undefined): Promise<void> {
  if (!roomId) {
    return;
  }
  deleteGameShell(roomId);
  await prisma.match.deleteMany({ where: { roomId } }).catch(() => undefined);
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
  await prisma.productEvent.deleteMany({ where: { roomId } }).catch(() => undefined);
}

async function main(): Promise<void> {
  await test('source: additive ProductEvent only, no people fields, no client API', () => {
    const schema = read('prisma/schema.prisma');
    assert.match(schema, /enum ProductEventType/);
    assert.match(schema, /model ProductEvent/);
    assert.match(schema, /ROOM_CREATED/);
    assert.match(schema, /ROOM_JOINED/);
    assert.match(schema, /SPECTATOR_JOINED/);
    assert.match(schema, /RECONNECT_SUCCEEDED/);
    assert.match(schema, /ROOM_CLOSED/);
    const productModel = schema.slice(schema.indexOf('model ProductEvent {'));
    assert.match(productModel, /roomId\s+String\?/);
    assert.doesNotMatch(productModel, /userId|playerId|email|isAdmin|@relation/);

    const migration = read('prisma/migrations/20260818120000_add_product_event/migration.sql');
    assert.match(migration, /CREATE TYPE "ProductEventType"/);
    assert.match(migration, /CREATE TABLE "ProductEvent"/);
    assert.doesNotMatch(migration, /DROP TABLE|DROP TYPE|DROP INDEX|ALTER TABLE/i);
    assert.doesNotMatch(migration, /REFERENCES "Room"/);

    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
    assert.deepEqual(Object.keys(pkg.dependencies ?? {}).sort(), [
      '@prisma/client',
      '@wanasatna/shared',
      'argon2',
      'cors',
      'dotenv',
      'express',
      'prisma',
      'socket.io',
      'zod',
    ]);

    const routes = read('src/routes/index.ts');
    assert.doesNotMatch(routes, /analytics/i);

    const matchHistory = read('src/modules/match/match-history.service.ts');
    assert.doesNotMatch(matchHistory, /recordProductEvent|ProductEvent/);

    const gameService = read('src/modules/game/game.service.ts');
    assert.doesNotMatch(gameService, /recordProductEvent/);

    const abuse = read('src/lib/abuse-limiter.ts');
    assert.doesNotMatch(abuse, /recordProductEvent|productEvent/);

    const recorder = read('src/modules/analytics/product-event.service.ts');
    assert.match(recorder, /product-analytics-write-failed/);
    assert.match(recorder, /export async function recordProductEvent/);
    assert.doesNotMatch(recorder, /userId|playerId|email|displayName|userAgent|ipAddress|roomCode|isAdmin/);
  });

  await test('1 create room → one ROOM_CREATED', async () => {
    const host = await mustCreate(uniqueName('منشئ'));
    const rows = await eventsFor(host.room.id);
    assert.deepEqual(typesOf(rows), [ProductEventType.ROOM_CREATED]);
    assert.equal(rows[0]?.roomCap, MAX_ROOM_PLAYERS);
    assert.equal(rows[0]?.playerCount, 1);
    assert.equal(rows[0]?.gameId, null);
    await cleanupRoom(host.room.id);
  });

  await test('2 new join → ROOM_JOINED; 3-4 reconnect is not ROOM_JOINED', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    let rows = await eventsFor(host.room.id);
    assert.deepEqual(typesOf(rows), [
      ProductEventType.ROOM_CREATED,
      ProductEventType.ROOM_JOINED,
    ]);
    assert.equal(rows[1]?.playerCount, 2);

    await handlePlayerDisconnect(guest.player.id, guest.room.id);
    const recon = await reconnectPlayer({
      playerId: guest.player.id,
      reconnectToken: guest.reconnectToken,
      roomId: guest.room.id,
    });
    assert.equal(recon.success, true);

    rows = await eventsFor(host.room.id);
    assert.deepEqual(typesOf(rows), [
      ProductEventType.ROOM_CREATED,
      ProductEventType.ROOM_JOINED,
      ProductEventType.RECONNECT_SUCCEEDED,
    ]);
    assert.equal(rows.filter((row) => row.type === ProductEventType.ROOM_JOINED).length, 1);
    await cleanupRoom(host.room.id);
  });

  await test('5 mid-match join → ROOM_JOINED + SPECTATOR_JOINED', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const init = await initGameShell(host.room.id, host.player.id, { gameId: 'who-wrote-it' });
    assert.equal(init.success, true, init.success ? '' : init.error.message);

    const spectator = await mustJoin(host.room.code, uniqueName('مشاهد'));
    assert.equal(spectator.player.isSpectator, true);

    const rows = await eventsFor(host.room.id);
    assert.deepEqual(typesOf(rows), [
      ProductEventType.ROOM_CREATED,
      ProductEventType.ROOM_JOINED,
      ProductEventType.SPECTATOR_JOINED,
    ]);
    assert.equal(rows[1]?.playerCount, 2);
    await cleanupRoom(host.room.id);
  });

  await test('6 normal room close → ROOM_CLOSED', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const left = await leaveRoom(host.player.id, host.room.id);
    assert.equal(left.success, true);
    if (left.success) {
      assert.equal(left.data.roomDeleted, true);
    }

    const rows = await eventsFor(host.room.id);
    assert.deepEqual(typesOf(rows), [
      ProductEventType.ROOM_CREATED,
      ProductEventType.ROOM_CLOSED,
    ]);
    await cleanupRoom(host.room.id);
  });

  await test('7 admin force-close → ROOM_CLOSED', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const closed = await adminForceCloseRoom(host.room.id, 'p14-b-admin');
    assert.equal(closed.success, true);
    if (closed.success) {
      assert.equal(closed.data.alreadyClosed, false);
    }

    const rows = await eventsFor(host.room.id);
    assert.deepEqual(typesOf(rows), [
      ProductEventType.ROOM_CREATED,
      ProductEventType.ROOM_CLOSED,
    ]);
    await cleanupRoom(host.room.id);
  });

  await test('8 analytics write failure does not fail create/join/reconnect', async () => {
    setProductEventWriterForTests(async () => {
      throw new Error('analytics-unavailable');
    });
    try {
      const host = await mustCreate(uniqueName('مضيف'));
      const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
      await handlePlayerDisconnect(guest.player.id, guest.room.id);
      const recon = await reconnectPlayer({
        playerId: guest.player.id,
        reconnectToken: guest.reconnectToken,
        roomId: guest.room.id,
      });
      assert.equal(recon.success, true);
      assert.equal((await eventsFor(host.room.id)).length, 0);
      await cleanupRoom(host.room.id);
    } finally {
      setProductEventWriterForTests(null);
    }
  });

  await test('9-10 persisted rows store usage fields only', async () => {
    const playerName = uniqueName('اسمسري');
    const host = await mustCreate(playerName);
    const guestName = uniqueName('ضيفسري');
    await mustJoin(host.room.code, guestName);
    const rows = await eventsFor(host.room.id);
    const raw = JSON.stringify(rows);
    assert.doesNotMatch(raw, new RegExp(playerName));
    assert.doesNotMatch(raw, new RegExp(guestName));
    assert.doesNotMatch(raw, new RegExp(host.room.code));
    assert.doesNotMatch(raw, /@example\.com|userId|playerId|127\.0\.0\.1|User-Agent|reconnectToken/i);
    assert.doesNotMatch(raw, /chat|stroke|drawing|answer|secret/i);
    for (const row of rows) {
      assert.deepEqual(
        Object.keys(row).sort(),
        ['createdAt', 'gameId', 'id', 'playerCount', 'roomCap', 'roomId', 'type'],
      );
    }
    await cleanupRoom(host.room.id);
  });

  await test('11 invalid/failed requests do not persist analytics', async () => {
    const before = await prisma.productEvent.count();
    const invalidCreate = await createRoom({ playerName: '' });
    assert.equal(invalidCreate.success, false);
    const missingRoom = await joinRoom({ roomCode: '000000', playerName: uniqueName('وهمي') });
    assert.equal(missingRoom.success, false);
    const badReconnect = await reconnectPlayer({
      playerId: '00000000-0000-4000-8000-000000000000',
      reconnectToken: 'not-a-valid-reconnect-token',
      roomId: '00000000-0000-4000-8000-000000000000',
    });
    assert.equal(badReconnect.success, false);
    const after = await prisma.productEvent.count();
    assert.equal(after, before);
  });

  await test('12 Match start/complete is not duplicated into ProductEvent', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const init = await initGameShell(host.room.id, host.player.id, { gameId: 'who-wrote-it' });
    assert.equal(init.success, true, init.success ? '' : init.error.message);
    await completePersistedMatch(host.room.id, []);
    const rows = await eventsFor(host.room.id);
    assert.deepEqual(typesOf(rows), [ProductEventType.ROOM_CREATED]);
    await cleanupRoom(host.room.id);
  });

  await test('helper rejects identity-shaped extra fields by API', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    await recordProductEvent({
      type: ProductEventType.ROOM_JOINED,
      roomId: host.room.id,
      roomCap: 8,
      playerCount: 1,
    });
    const extra = recordProductEvent as unknown as (input: Record<string, unknown>) => Promise<void>;
    await extra({
      type: ProductEventType.ROOM_JOINED,
      roomId: host.room.id,
      userId: 'should-never-store',
      playerId: 'should-never-store',
      email: 'leak@example.com',
      roomCode: host.room.code,
    });
    const rows = await eventsFor(host.room.id);
    const raw = JSON.stringify(rows);
    assert.doesNotMatch(raw, /should-never-store|leak@example.com/);
    assert.doesNotMatch(raw, new RegExp(host.room.code));
    await cleanupRoom(host.room.id);
  });

  if (failed > 0) {
    console.error(`\nP14-B failed: ${failed}, passed: ${passed}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nP14-B passed: ${passed}`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
