/**
 * P12-B.2 — startup reconciliation + atomic permanent departure.
 * Run: pnpm --filter @wanasatna/server test:p12-b2
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerStatus } from '@prisma/client';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { MAX_ROOM_PLAYERS } from '../src/modules/room/room.utils.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { expireDisconnectedPlayer } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { endRoomByHost } from '../src/modules/room/services/end-room.service.js';
import {
  handlePlayerDisconnect,
  kickPlayer,
  leaveRoom,
} from '../src/modules/room/services/leave-room.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';
import {
  deleteOrphanRooms,
  reconcilePersistedRoomLifecycle,
  reconcileStaleConnectedPlayers,
} from '../src/modules/room/services/room-startup-reconciliation.service.js';
import { lockRoom, unlockRoom } from '../src/modules/room/services/shared-room.service.js';

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

async function mustJoin(roomCode: string, playerName: string) {
  const result = await joinRoom({ roomCode, playerName });
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function loadPlayer(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  assert.ok(player, `missing player ${playerId}`);
  return player;
}

async function cleanupRoom(roomId: string | undefined): Promise<void> {
  if (!roomId) {
    return;
  }
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
}

async function main(): Promise<void> {
  await test('host-only End Room deletes the whole room authoritatively', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));

    const rejected = await endRoomByHost(host.room.id, guest.player.id);
    assert.equal(rejected.success, false);
    if (!rejected.success) assert.equal(rejected.error.code, 'NOT_HOST');
    assert.ok(await prisma.room.findUnique({ where: { id: host.room.id } }));

    const ended = await endRoomByHost(host.room.id, host.player.id);
    assert.equal(ended.success, true);
    assert.equal(await prisma.room.findUnique({ where: { id: host.room.id } }), null);
    assert.equal(await prisma.player.findFirst({ where: { roomId: host.room.id } }), null);

    const announceSource = read('src/modules/room/room-socket-announce.ts');
    assert.match(announceSource, /onRoomDeleted\(io, roomId\)/);
  });

  await test('source: startup order reconciles before sockets/listen', () => {
    const source = read('src/index.ts');
    const reconcileAt = source.indexOf('reconcilePersistedRoomLifecycle');
    const socketsAt = source.indexOf('createSocketServer');
    const listenAt = source.indexOf('httpServer.listen');
    assert.ok(reconcileAt >= 0 && socketsAt > reconcileAt && listenAt > socketsAt);
    assert.match(source, /startup-reconciliation-failed/);
    assert.match(source, /process\.exit\(1\)/);
  });

  await test('source: disconnect stays non-permanent; AuthSession and Player.userId remain', () => {
    const disconnect = read('src/modules/room/services/leave-room.service.ts');
    const disconnectFn = disconnect.slice(
      disconnect.indexOf('export async function handlePlayerDisconnect'),
    );
    assert.match(disconnectFn, /PlayerStatus\.DISCONNECTED/);
    assert.doesNotMatch(disconnectFn, /permanentlyDepartPlayer/);
    assert.doesNotMatch(disconnectFn, /PlayerStatus\.LEFT/);

    const schema = read('prisma/schema.prisma');
    assert.match(schema, /model AuthSession \{/);
    assert.match(schema, /userId\s+String\?/);
    assert.equal(MAX_ROOM_PLAYERS, 8);
  });

  await test('1-7 startup CONNECTED reconciliation is idempotent and preserves seat', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    const staleAt = new Date(Date.now() - 60 * 60 * 1000);

    await prisma.player.update({
      where: { id: host.player.id },
      data: { lastSeenAt: staleAt },
    });
    await handlePlayerDisconnect(guest.player.id, guest.room.id);
    const disconnectedBefore = await loadPlayer(guest.player.id);
    const disconnectedSeenAt = disconnectedBefore.lastSeenAt;

    await prisma.player.update({
      where: { id: guest.player.id },
      data: { status: PlayerStatus.LEFT, reconnectTokenHash: 'left-hash' },
    });
    const leftBefore = await loadPlayer(guest.player.id);

    const hostBefore = await loadPlayer(host.player.id);
    const first = await reconcileStaleConnectedPlayers();
    assert.ok(first >= 1);

    const hostAfter = await loadPlayer(host.player.id);
    assert.equal(hostAfter.status, PlayerStatus.DISCONNECTED);
    assert.equal(hostAfter.reconnectTokenHash, hostBefore.reconnectTokenHash);
    assert.ok(hostAfter.lastSeenAt.getTime() > staleAt.getTime());

    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, host.player.id);

    const leftAfter = await loadPlayer(guest.player.id);
    assert.equal(leftAfter.status, PlayerStatus.LEFT);
    assert.equal(leftAfter.reconnectTokenHash, leftBefore.reconnectTokenHash);
    assert.equal(leftAfter.lastSeenAt.getTime(), leftBefore.lastSeenAt.getTime());

    const second = await reconcileStaleConnectedPlayers();
    const hostSecond = await loadPlayer(host.player.id);
    assert.equal(hostSecond.lastSeenAt.getTime(), hostAfter.lastSeenAt.getTime());
    assert.equal(second, 0);
    void disconnectedSeenAt;

    await cleanupRoom(host.room.id);
  });

  await test('5 DISCONNECTED lastSeenAt is not reset by reconciliation', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    await handlePlayerDisconnect(guest.player.id, guest.room.id);
    const before = await loadPlayer(guest.player.id);
    await reconcileStaleConnectedPlayers();
    const after = await loadPlayer(guest.player.id);
    assert.equal(after.status, PlayerStatus.DISCONNECTED);
    assert.equal(after.lastSeenAt.getTime(), before.lastSeenAt.getTime());
    await cleanupRoom(host.room.id);
  });

  await test('9-13 startup orphan room cleanup', async () => {
    const orphanA = await mustCreate(uniqueName('يتيم'));
    const orphanB = await mustCreate(uniqueName('يتيم'));
    await prisma.player.updateMany({
      where: { roomId: { in: [orphanA.room.id, orphanB.room.id] } },
      data: { status: PlayerStatus.LEFT, reconnectTokenHash: null },
    });

    const reconnectable = await mustCreate(uniqueName('عائد'));
    await handlePlayerDisconnect(reconnectable.player.id, reconnectable.room.id);

    const connected = await mustCreate(uniqueName('حي'));
    await reconcilePersistedRoomLifecycle();

    assert.equal(await prisma.room.findUnique({ where: { id: orphanA.room.id } }), null);
    assert.equal(await prisma.room.findUnique({ where: { id: orphanB.room.id } }), null);
    assert.ok(await prisma.room.findUnique({ where: { id: reconnectable.room.id } }));
    const connectedAfter = await loadPlayer(connected.player.id);
    assert.equal(connectedAfter.status, PlayerStatus.DISCONNECTED);
    assert.ok(await prisma.room.findUnique({ where: { id: connected.room.id } }));

    const removedAgain = await deleteOrphanRooms();
    assert.ok(removedAgain >= 0);
    assert.ok(await prisma.room.findUnique({ where: { id: connected.room.id } }));

    await cleanupRoom(reconnectable.room.id);
    await cleanupRoom(connected.room.id);
  });

  await test('14-15 reconnect after startup reconciliation keeps id/host/token', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    await reconcileStaleConnectedPlayers();

    const hostReconnect = await reconnectPlayer({
      playerId: host.player.id,
      reconnectToken: host.reconnectToken,
      roomId: host.room.id,
      roomCode: host.room.code,
    });
    assert.equal(hostReconnect.success, true);
    if (!hostReconnect.success) {
      throw new Error(hostReconnect.error.message);
    }
    assert.equal(hostReconnect.data.player.id, host.player.id);
    assert.equal(hostReconnect.data.player.status, PlayerStatus.CONNECTED);
    assert.equal(hostReconnect.data.player.isHost, true);

    const guestReconnect = await reconnectPlayer({
      playerId: guest.player.id,
      reconnectToken: guest.reconnectToken,
      roomId: guest.room.id,
      roomCode: guest.room.code,
    });
    assert.equal(guestReconnect.success, true);
    if (!guestReconnect.success) {
      throw new Error(guestReconnect.error.message);
    }
    assert.equal(guestReconnect.data.player.id, guest.player.id);
    assert.equal(guestReconnect.data.player.status, PlayerStatus.CONNECTED);
    assert.equal(guestReconnect.data.player.isHost, false);

    await cleanupRoom(host.room.id);
  });

  await test('16-20 permanent departure: leave, host transfer, last player, expiry', async () => {
    const stay = await mustCreate(uniqueName('مضيف'));
    const leaver = await mustJoin(stay.room.code, uniqueName('خارج'));
    const left = await leaveRoom(leaver.player.id, leaver.room.id);
    assert.equal(left.success, true);
    if (!left.success) {
      throw new Error(left.error.message);
    }
    assert.equal(left.data.roomDeleted, false);
    const leftRow = await loadPlayer(leaver.player.id);
    assert.equal(leftRow.status, PlayerStatus.LEFT);
    assert.equal(leftRow.reconnectTokenHash, null);
    assert.ok(await prisma.room.findUnique({ where: { id: stay.room.id } }));

    const hosted = await mustCreate(uniqueName('مضيف'));
    const successor = await mustJoin(hosted.room.code, uniqueName('وريث'));
    const hostLeft = await leaveRoom(hosted.player.id, hosted.room.id);
    assert.equal(hostLeft.success, true);
    if (!hostLeft.success) {
      throw new Error(hostLeft.error.message);
    }
    assert.equal(hostLeft.data.roomDeleted, false);
    assert.equal(hostLeft.data.hostChanged?.hostPlayerId, successor.player.id);
    const hostedRoom = await prisma.room.findUnique({ where: { id: hosted.room.id } });
    assert.equal(hostedRoom?.hostPlayerId, successor.player.id);

    const last = await mustCreate(uniqueName('أخير'));
    const lastLeave = await leaveRoom(last.player.id, last.room.id);
    assert.equal(lastLeave.success, true);
    if (!lastLeave.success) {
      throw new Error(lastLeave.error.message);
    }
    assert.equal(lastLeave.data.roomDeleted, true);
    assert.equal(await prisma.room.findUnique({ where: { id: last.room.id } }), null);
    assert.equal(await prisma.player.findUnique({ where: { id: last.player.id } }), null);

    const expiring = await mustCreate(uniqueName('منته'));
    await handlePlayerDisconnect(expiring.player.id, expiring.room.id);
    const disconnected = await loadPlayer(expiring.player.id);
    assert.equal(disconnected.status, PlayerStatus.DISCONNECTED);
    await prisma.player.update({
      where: { id: expiring.player.id },
      data: { lastSeenAt: new Date(Date.now() - 4 * 60 * 1000) },
    });
    const expired = await expireDisconnectedPlayer(expiring.player.id, expiring.room.id);
    const expiredRoom = await prisma.room.findUnique({ where: { id: expiring.room.id } });
    assert.equal(expiredRoom, null);
    if (expired) {
      assert.equal(expired.roomDeleted, true);
    }

    await cleanupRoom(stay.room.id);
    await cleanupRoom(hosted.room.id);
  });

  await test('21-22 kick uses coherent lifecycle and clears reconnect token', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    const kicked = await kickPlayer(host.player.id, host.room.id, { playerId: guest.player.id });
    assert.equal(kicked.success, true);
    if (!kicked.success) {
      throw new Error(kicked.error.message);
    }
    assert.equal(kicked.data.roomDeleted, false);
    const kickedRow = await prisma.player.findUnique({ where: { id: guest.player.id } });
    assert.ok(kickedRow);
    assert.equal(kickedRow?.status, PlayerStatus.LEFT);
    assert.equal(kickedRow?.reconnectTokenHash, null);
    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, host.player.id);
    await cleanupRoom(host.room.id);
  });

  await test('23-24 concurrent last departures never leave an empty LEFT-only Room', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    const [first, second] = await Promise.all([
      leaveRoom(host.player.id, host.room.id),
      leaveRoom(guest.player.id, guest.room.id),
    ]);
    assert.equal(first.success, true);
    assert.equal(second.success, true);

    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    if (room) {
      const active = await prisma.player.count({
        where: {
          roomId: room.id,
          status: { in: [PlayerStatus.CONNECTED, PlayerStatus.DISCONNECTED] },
        },
      });
      assert.ok(active >= 1);
      assert.ok([host.player.id, guest.player.id].includes(room.hostPlayerId));
      await cleanupRoom(room.id);
    } else {
      assert.equal(await prisma.player.count({ where: { roomId: host.room.id } }), 0);
    }
  });

  await test('25 expiry vs reconnect: exactly one winner', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    await handlePlayerDisconnect(guest.player.id, guest.room.id);
    await prisma.player.update({
      where: { id: guest.player.id },
      data: { lastSeenAt: new Date(Date.now() - 4 * 60 * 1000) },
    });

    const [expired, reconnected] = await Promise.all([
      expireDisconnectedPlayer(guest.player.id, guest.room.id),
      reconnectPlayer({
        playerId: guest.player.id,
        reconnectToken: guest.reconnectToken,
        roomId: guest.room.id,
        roomCode: guest.room.code,
      }),
    ]);

    const guestRow = await prisma.player.findUnique({ where: { id: guest.player.id } });
    const reconnectWon = reconnected.success && guestRow?.status === PlayerStatus.CONNECTED;
    const expiryWon = !reconnectWon && (guestRow === null || guestRow.status === PlayerStatus.LEFT);
    assert.equal(reconnectWon || expiryWon, true, 'exactly one of reconnect/expiry must win');
    assert.equal(Boolean(reconnectWon && expiryWon), false);
    if (reconnectWon) {
      assert.equal(expired, null);
    }
    if (expiryWon) {
      assert.equal(reconnected.success, false);
    }

    await cleanupRoom(host.room.id);
  });

  await test('26 duplicate permanent removal is safe', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    const first = await leaveRoom(guest.player.id, guest.room.id);
    const second = await leaveRoom(guest.player.id, guest.room.id);
    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.ok(await prisma.room.findUnique({ where: { id: host.room.id } }));
    const last = await mustCreate(uniqueName('أخير'));
    const gone = await leaveRoom(last.player.id, last.room.id);
    const again = await leaveRoom(last.player.id, last.room.id);
    assert.equal(gone.success, true);
    assert.equal(again.success, true);
    if (again.success) {
      assert.equal(again.data.roomDeleted, true);
    }
    await cleanupRoom(host.room.id);
  });

  await test('27 temporary disconnect does not transfer host or delete Room', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    await handlePlayerDisconnect(host.player.id, host.room.id);
    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, host.player.id);
    const hostRow = await loadPlayer(host.player.id);
    assert.equal(hostRow.status, PlayerStatus.DISCONNECTED);
    assert.ok(hostRow.reconnectTokenHash);
    await cleanupRoom(host.room.id);
  });

  await test('33 lock/unlock unchanged', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const locked = await lockRoom(host.player.id, host.room.id);
    assert.equal(locked.success, true);
    if (locked.success) {
      assert.equal(locked.data.isLocked, true);
    }
    const unlocked = await unlockRoom(host.player.id, host.room.id);
    assert.equal(unlocked.success, true);
    if (unlocked.success) {
      assert.equal(unlocked.data.isLocked, false);
    }
    await cleanupRoom(host.room.id);
  });

  await prisma.$disconnect();

  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
