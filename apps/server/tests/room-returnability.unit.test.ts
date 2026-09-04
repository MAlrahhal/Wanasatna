/**
 * Read-only room returnability used before showing a persistent reconnect claim.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/room-returnability.unit.test.ts
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { RoomStatus } from '@prisma/client';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { endRoomByHost } from '../src/modules/room/services/end-room.service.js';
import { isRoomCurrentlyReturnable } from '../src/modules/room/services/room-returnability.service.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? (error.stack ?? error.message) : error);
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

async function cleanupRoom(roomId: string | undefined): Promise<void> {
  if (!roomId) {
    return;
  }
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
}

async function getJson(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: (await response.json()) as {
      success?: boolean;
      data?: { returnable?: boolean; players?: unknown };
    },
  };
}

async function main(): Promise<void> {
  await test('lobby room is returnable', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    try {
      assert.equal(await isRoomCurrentlyReturnable(host.room.code), true);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('playing room is still returnable', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    try {
      await prisma.room.update({
        where: { id: host.room.id },
        data: { status: RoomStatus.PLAYING },
      });
      assert.equal(await isRoomCurrentlyReturnable(host.room.code), true);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('closed room is not returnable', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    try {
      await prisma.room.update({
        where: { id: host.room.id },
        data: { status: RoomStatus.CLOSED },
      });
      assert.equal(await isRoomCurrentlyReturnable(host.room.code), false);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('missing room is not returnable', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const code = host.room.code;
    const ended = await endRoomByHost(host.room.id, host.player.id);
    assert.equal(ended.success, true);
    assert.equal(await isRoomCurrentlyReturnable(code), false);
  });

  await test('GET /api/rooms/:code/returnable is read-only and exposes only returnable', async () => {
    const app = createApp();
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;
    const host = await mustCreate(uniqueName('مضيف'));

    try {
      const open = await getJson(baseUrl, `/api/rooms/${host.room.code}/returnable`);
      assert.equal(open.status, 200);
      assert.equal(open.body.success, true);
      assert.equal(open.body.data?.returnable, true);
      assert.equal('players' in (open.body.data ?? {}), false);

      await prisma.room.update({
        where: { id: host.room.id },
        data: { status: RoomStatus.CLOSED },
      });
      const closed = await getJson(baseUrl, `/api/rooms/${host.room.code}/returnable`);
      assert.equal(closed.body.data?.returnable, false);

      const missing = await getJson(baseUrl, '/api/rooms/000000/returnable');
      assert.equal(missing.status, 200);
      assert.equal(missing.body.data?.returnable, false);

      const invalid = await getJson(baseUrl, '/api/rooms/abc/returnable');
      assert.equal(invalid.body.data?.returnable, false);
    } finally {
      await cleanupRoom(host.room.id);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
