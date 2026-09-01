/**
 * Durable Room History write-path coverage.
 * Run: pnpm --filter @wanasatna/server test:admin-history-write
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerStatus, RoomCloseReason } from '@prisma/client';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { deleteGameShell, initGameShell } from '../src/modules/game/game.service.js';
import { beginPersistedMatch } from '../src/modules/match/match-history.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { endRoomByHost } from '../src/modules/room/services/end-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import {
  handlePlayerDisconnect,
  kickPlayer,
  leaveRoom,
} from '../src/modules/room/services/leave-room.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';
import { cleanupRoomIfEmpty } from '../src/modules/room/services/room-cleanup.service.js';
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
  return `${prefix}${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 100)}`;
}

async function mustCreate(playerName: string, adminCreated = false) {
  const result = await createRoom({ playerName }, null, adminCreated ? 'ADMIN' : null);
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

async function cleanupHistory(liveRoomIds: string[]): Promise<void> {
  await prisma.match.deleteMany({ where: { roomHistory: { liveRoomId: { in: liveRoomIds } } } });
  await prisma.room.deleteMany({ where: { id: { in: liveRoomIds } } });
  await prisma.roomHistory.deleteMany({ where: { liveRoomId: { in: liveRoomIds } } });
}

async function loadHistory(liveRoomId: string) {
  const history = await prisma.roomHistory.findUnique({
    where: { liveRoomId },
    include: {
      participations: { orderBy: { joinedAt: 'asc' } },
      hostChanges: { orderBy: { assignedAt: 'asc' } },
    },
  });
  assert.ok(history, `missing RoomHistory for ${liveRoomId}`);
  return history;
}

async function main(): Promise<void> {
  await test('schema and migration are additive and do not persist secrets', () => {
    const schema = read('prisma/schema.prisma');
    const migration = read(
      'prisma/migrations/20260901000000_add_durable_room_history/migration.sql',
    );
    const writer = read('src/modules/room/services/room-history-write.service.ts');

    assert.match(schema, /model RoomHistory \{/);
    assert.match(schema, /model RoomParticipationHistory \{/);
    assert.match(schema, /model RoomHostHistory \{/);
    assert.match(schema, /roomHistoryId\s+String\?/);
    assert.match(migration, /ALTER TABLE "Match" ADD COLUMN "roomHistoryId" TEXT/);
    assert.doesNotMatch(migration, /DROP (TABLE|COLUMN|TYPE)/);
    assert.doesNotMatch(migration, /UPDATE "Match"/);
    assert.doesNotMatch(
      writer,
      /reconnectToken|tokenHash|passwordHash|encryptedSecret|codeHash|ipAddress/,
    );
    assert.match(
      read('src/modules/room/services/end-room.service.ts'),
      /RoomCloseReason\.HOST_ENDED/,
    );
    assert.match(
      read('src/modules/admin/admin-rooms.service.ts'),
      /RoomCloseReason\.ADMIN_FORCE_CLOSED/,
    );
    assert.match(
      read('src/modules/room/services/room-startup-reconciliation.service.ts'),
      /RoomCloseReason\.STARTUP_RECONCILIATION/,
    );
  });

  await test('create writes exactly one complete room, participation, and host record', async () => {
    const host = await mustCreate(uniqueName('host'), true);
    try {
      const room = await prisma.room.findUnique({ where: { id: host.room.id } });
      const history = await loadHistory(host.room.id);
      assert.equal(room?.historyId, history.id);
      assert.equal(history.roomCode, host.room.code);
      assert.equal(history.originalHostName, host.player.name);
      assert.equal(history.currentHostPlayerId, host.player.id);
      assert.equal(history.currentHostName, host.player.name);
      assert.equal(history.createdByAdmin, true);
      assert.equal(history.isComplete, true);
      assert.equal(history.participations.length, 1);
      assert.equal(history.participations[0]?.livePlayerId, host.player.id);
      assert.equal(history.participations[0]?.joinedAsSpectator, false);
      assert.equal(history.participations[0]?.wasHost, true);
      assert.equal(history.hostChanges.length, 1);
      assert.equal(history.hostChanges[0]?.livePlayerId, host.player.id);
    } finally {
      await cleanupHistory([host.room.id]);
    }
  });

  await test('lock and unlock retain current and ever-locked history snapshots', async () => {
    const host = await mustCreate(uniqueName('host'));
    try {
      const locked = await lockRoom(host.player.id, host.room.id);
      assert.equal(locked.success, true);
      const lockedHistory = await loadHistory(host.room.id);
      assert.equal(lockedHistory.isLocked, true);
      assert.equal(lockedHistory.wasEverLocked, true);

      const unlocked = await unlockRoom(host.player.id, host.room.id);
      assert.equal(unlocked.success, true);
      const unlockedHistory = await loadHistory(host.room.id);
      assert.equal(unlockedHistory.isLocked, false);
      assert.equal(unlockedHistory.wasEverLocked, true);
    } finally {
      await cleanupHistory([host.room.id]);
    }
  });

  await test('join writes one seat; disconnect/reconnect never duplicates it', async () => {
    const host = await mustCreate(uniqueName('host'));
    const guest = await mustJoin(host.room.code, uniqueName('guest'));
    try {
      const before = await loadHistory(host.room.id);
      const guestBefore = before.participations.find(
        (participation) => participation.livePlayerId === guest.player.id,
      );
      assert.ok(guestBefore);
      assert.equal(before.participations.length, 2);

      await handlePlayerDisconnect(guest.player.id, guest.room.id);
      const disconnected = await loadHistory(host.room.id);
      assert.equal(
        disconnected.participations.find(
          (participation) => participation.livePlayerId === guest.player.id,
        )?.leftAt,
        null,
      );

      const reconnected = await reconnectPlayer({
        playerId: guest.player.id,
        reconnectToken: guest.reconnectToken,
        roomId: guest.room.id,
        roomCode: guest.room.code,
      });
      assert.equal(reconnected.success, true);

      const after = await loadHistory(host.room.id);
      assert.equal(after.participations.length, 2);
      assert.equal(
        after.participations
          .find((participation) => participation.livePlayerId === guest.player.id)
          ?.joinedAt.getTime(),
        guestBefore.joinedAt.getTime(),
      );
    } finally {
      await cleanupHistory([host.room.id]);
    }
  });

  await test('leave, kick, and host transfer are recorded transactionally', async () => {
    const host = await mustCreate(uniqueName('host'));
    const kicked = await mustJoin(host.room.code, uniqueName('kicked'));
    const successor = await mustJoin(host.room.code, uniqueName('next'));
    try {
      const kickedResult = await kickPlayer(host.player.id, host.room.id, {
        playerId: kicked.player.id,
      });
      assert.equal(kickedResult.success, true);

      const hostLeave = await leaveRoom(host.player.id, host.room.id);
      assert.equal(hostLeave.success, true);
      assert.equal(
        hostLeave.success && hostLeave.data.hostChanged?.hostPlayerId,
        successor.player.id,
      );

      const history = await loadHistory(host.room.id);
      assert.ok(
        history.participations.find(
          (participation) => participation.livePlayerId === kicked.player.id,
        )?.leftAt,
      );
      assert.ok(
        history.participations.find(
          (participation) => participation.livePlayerId === host.player.id,
        )?.leftAt,
      );
      assert.equal(history.currentHostPlayerId, successor.player.id);
      assert.equal(
        history.participations.find(
          (participation) => participation.livePlayerId === successor.player.id,
        )?.wasHost,
        true,
      );
      assert.deepEqual(
        history.hostChanges.map((change) => change.livePlayerId),
        [host.player.id, successor.player.id],
      );
    } finally {
      await cleanupHistory([host.room.id]);
    }
  });

  await test('a mid-game join is permanently marked as joined-as-spectator', async () => {
    const host = await mustCreate(uniqueName('host'));
    try {
      const shell = await initGameShell(host.room.id, host.player.id, { gameId: 'fast-answer' });
      assert.equal(shell.success, true);
      const spectator = await mustJoin(host.room.code, uniqueName('spectator'));
      const history = await loadHistory(host.room.id);
      assert.equal(
        history.participations.find(
          (participation) => participation.livePlayerId === spectator.player.id,
        )?.joinedAsSpectator,
        true,
      );
    } finally {
      deleteGameShell(host.room.id);
      await cleanupHistory([host.room.id]);
    }
  });

  await test('host end closes history while Room deletion preserves history and Match linkage', async () => {
    const host = await mustCreate(uniqueName('host'));
    const guest = await mustJoin(host.room.code, uniqueName('guest'));
    let matchId: string | null = null;
    try {
      const historyBefore = await loadHistory(host.room.id);
      matchId = await beginPersistedMatch({
        roomId: host.room.id,
        gameId: 'judge',
        participantPlayerIds: [host.player.id, guest.player.id],
      });
      assert.ok(matchId);

      const linkedBefore = await prisma.match.findUnique({ where: { id: matchId } });
      assert.equal(linkedBefore?.roomHistoryId, historyBefore.id);

      const ended = await endRoomByHost(host.room.id, host.player.id);
      assert.equal(ended.success, true);
      assert.equal(await prisma.room.findUnique({ where: { id: host.room.id } }), null);

      const historyAfter = await loadHistory(host.room.id);
      const linkedAfter = await prisma.match.findUnique({ where: { id: matchId } });
      assert.ok(historyAfter.closedAt);
      assert.equal(historyAfter.closeReason, RoomCloseReason.HOST_ENDED);
      assert.ok(historyAfter.participations.every((participation) => participation.leftAt));
      assert.equal(linkedAfter?.roomId, null);
      assert.equal(linkedAfter?.roomHistoryId, historyAfter.id);
      assert.equal(await prisma.matchParticipant.count({ where: { matchId } }), 2);
    } finally {
      await cleanupHistory([host.room.id]);
    }
  });

  await test('automatic empty cleanup closes but preserves durable history', async () => {
    const host = await mustCreate(uniqueName('host'));
    try {
      await prisma.player.update({
        where: { id: host.player.id },
        data: {
          status: PlayerStatus.LEFT,
          reconnectTokenHash: null,
          lastSeenAt: new Date(),
        },
      });
      assert.equal(await cleanupRoomIfEmpty(host.room.id), true);

      const history = await loadHistory(host.room.id);
      assert.equal(history.closeReason, RoomCloseReason.ROOM_EMPTY);
      assert.ok(history.closedAt);
      assert.ok(history.participations[0]?.leftAt);
    } finally {
      await cleanupHistory([host.room.id]);
    }
  });

  await test('reused room code produces a distinct history and Match link', async () => {
    const first = await mustCreate(uniqueName('first'));
    const reusedCode = first.room.code;
    const firstHistory = await loadHistory(first.room.id);
    const ended = await endRoomByHost(first.room.id, first.player.id);
    assert.equal(ended.success, true);

    const second = await mustCreate(uniqueName('second'));
    let matchId: string | null = null;
    try {
      const secondHistoryBefore = await loadHistory(second.room.id);
      await prisma.$transaction([
        prisma.room.update({ where: { id: second.room.id }, data: { code: reusedCode } }),
        prisma.roomHistory.update({
          where: { id: secondHistoryBefore.id },
          data: { roomCode: reusedCode },
        }),
      ]);

      matchId = await beginPersistedMatch({
        roomId: second.room.id,
        gameId: 'draw-guess',
        participantPlayerIds: [second.player.id],
      });
      assert.ok(matchId);
      const secondHistory = await loadHistory(second.room.id);
      const match = await prisma.match.findUnique({ where: { id: matchId } });

      assert.equal(firstHistory.roomCode, reusedCode);
      assert.equal(secondHistory.roomCode, reusedCode);
      assert.notEqual(firstHistory.id, secondHistory.id);
      assert.notEqual(firstHistory.liveRoomId, secondHistory.liveRoomId);
      assert.equal(match?.roomHistoryId, secondHistory.id);
    } finally {
      await cleanupHistory([first.room.id, second.room.id]);
    }
  });

  await prisma.$disconnect();
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
