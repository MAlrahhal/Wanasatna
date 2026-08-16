/**
 * P12-B.6 — durable Match / MatchParticipant history (not live-game restore).
 * Run: pnpm --filter @wanasatna/server test:p12-b6
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchStatus } from '@prisma/client';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import {
  cancelGameShellCountdown,
  deleteGameShell,
  initGameShell,
  startGameShellCountdown,
} from '../src/modules/game/game.service.js';
import {
  abortAllActiveMatches,
  abortPersistedMatch,
  beginPersistedMatch,
  completePersistedMatch,
} from '../src/modules/match/match-history.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { deleteRoomWithRelations } from '../src/modules/room/services/room-cleanup.service.js';
import { reconcilePersistedRoomLifecycle } from '../src/modules/room/services/room-startup-reconciliation.service.js';
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

function uniqueEmail(prefix: string): string {
  return `p12b6.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

async function cleanupEmail(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
}

async function cleanupMatch(matchId: string | null | undefined): Promise<void> {
  if (!matchId) {
    return;
  }
  await prisma.match.delete({ where: { id: matchId } }).catch(() => undefined);
}

async function mustCreate(playerName: string, accountUserId: string | null = null) {
  const result = await createRoom({ playerName }, accountUserId);
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function mustJoin(roomCode: string, playerName: string, accountUserId: string | null = null) {
  const result = await joinRoom({ roomCode, playerName }, accountUserId);
  assert.equal(result.success, true, result.success ? '' : result.error.message);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function loadMatch(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { participants: { orderBy: { createdAt: 'asc' } } },
  });
  assert.ok(match, `missing match ${matchId}`);
  return match;
}

async function main(): Promise<void> {
  await test('source: Match/MatchParticipant added; B.6 migration does not drop Session/ChatMessage', () => {
    const schema = read('prisma/schema.prisma');
    assert.match(schema, /enum MatchStatus \{/);
    assert.match(schema, /ACTIVE/);
    assert.match(schema, /COMPLETED/);
    assert.match(schema, /ABORTED/);
    assert.match(schema, /model Match \{/);
    assert.match(schema, /model MatchParticipant \{/);
    assert.match(schema, /roomCode\s+String/);
    assert.match(schema, /displayName\s+String/);
    assert.match(schema, /onDelete: SetNull/);
    assert.equal(MAX_ROOM_PLAYERS, 8);

    const migration = read('prisma/migrations/20260816210000_add_match_history/migration.sql');
    assert.match(migration, /CREATE TABLE "Match"/);
    assert.match(migration, /CREATE TABLE "MatchParticipant"/);
    assert.doesNotMatch(migration, /DROP TABLE "Session"/);
    assert.doesNotMatch(migration, /DROP TABLE "ChatMessage"/);
    assert.match(migration, /Match_roomId_active_key/);
  });

  await test('source: live Game Shell stays memory-only; startup aborts ACTIVE history', () => {
    const indexSource = read('src/index.ts');
    const reconcileAt = indexSource.indexOf('reconcilePersistedRoomLifecycle');
    const socketsAt = indexSource.indexOf('createSocketServer');
    const listenAt = indexSource.indexOf('httpServer.listen');
    assert.ok(reconcileAt >= 0 && socketsAt > reconcileAt && listenAt > socketsAt);
    assert.doesNotMatch(indexSource, /prisma\.match/);

    const startup = read('src/modules/room/services/room-startup-reconciliation.service.ts');
    const abortAt = startup.indexOf('abortAllActiveMatches');
    const orphanAt = startup.indexOf('deleteOrphanRooms');
    assert.ok(abortAt >= 0 && abortAt < orphanAt);

    const shell = read('src/modules/game/game.service.ts');
    assert.match(shell, /shellsByRoomId/);
    assert.match(shell, /beginPersistedMatch/);
    assert.doesNotMatch(shell, /prisma\.match\.findMany/);
  });

  await test('countdown start writes ACTIVE match + participant snapshots', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    let matchId: string | undefined;

    try {
      const init = await initGameShell(host.room.id, host.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(init.success, true, init.success ? '' : init.error.message);

      const started = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(started.success, true, started.success ? '' : started.error.message);

      const match = await prisma.match.findFirst({
        where: { roomId: host.room.id, status: MatchStatus.ACTIVE },
        include: { participants: true },
      });
      assert.ok(match);
      matchId = match.id;
      assert.equal(match.gameId, 'bara-al-salafa');
      assert.equal(match.roomCode, host.room.code);
      assert.equal(match.endedAt, null);
      assert.equal(match.participants.length, 2);

      const names = match.participants.map((participant) => participant.displayName).sort();
      assert.deepEqual(
        names,
        [guest.player.name, host.player.name].sort(),
      );
      assert.ok(match.participants.every((participant) => participant.userId === null));
      assert.ok(match.participants.every((participant) => participant.score === null));
    } finally {
      deleteGameShell(host.room.id);
      await cleanupMatch(matchId);
      await prisma.room.deleteMany({ where: { id: host.room.id } }).catch(() => undefined);
    }
  });

  await test('guest stays unlinked; authenticated player snapshots userId', async () => {
    const email = uniqueEmail('acct');
    let matchId: string | undefined;
    let roomId: string | undefined;

    try {
      const registered = await registerUser({
        email,
        password: 'password-ok',
        preferredDisplayName: uniqueName('اسم'),
      });
      assert.equal(registered.success, true);
      if (!registered.success) {
        throw new Error(registered.error.message);
      }

      const host = await mustCreate(uniqueName('مضيف'), registered.data.user.id);
      const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
      roomId = host.room.id;

      const matchIdOrNull = await beginPersistedMatch({
        roomId: host.room.id,
        gameId: 'fast-answer',
        participantPlayerIds: [host.player.id, guest.player.id],
      });
      assert.ok(matchIdOrNull);
      matchId = matchIdOrNull;

      const match = await loadMatch(matchId);
      const hostRow = match.participants.find((participant) => participant.playerId === host.player.id);
      const guestRow = match.participants.find((participant) => participant.playerId === guest.player.id);
      assert.equal(hostRow?.userId, registered.data.user.id);
      assert.equal(hostRow?.displayName, host.player.name);
      assert.equal(guestRow?.userId, null);
      assert.equal(guestRow?.displayName, guest.player.name);
    } finally {
      await cleanupMatch(matchId);
      if (roomId) {
        await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
      }
      await cleanupEmail(email);
    }
  });

  await test('complete writes final score/rank/winner; abort leaves scores empty', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    const extra = await mustCreate(uniqueName('آخر'));
    let completedId: string | undefined;
    let abortedId: string | undefined;

    try {
      completedId = (await beginPersistedMatch({
        roomId: host.room.id,
        gameId: 'draw-guess',
        participantPlayerIds: [host.player.id, guest.player.id],
      })) ?? undefined;
      assert.ok(completedId);

      const completed = await completePersistedMatch(host.room.id, [
        { playerId: host.player.id, score: 200, rank: 1, isWinner: true },
        { playerId: guest.player.id, score: 50, rank: 2, isWinner: false },
      ]);
      assert.equal(completed, true);

      const finished = await loadMatch(completedId);
      assert.equal(finished.status, MatchStatus.COMPLETED);
      assert.ok(finished.endedAt);
      const winner = finished.participants.find((participant) => participant.playerId === host.player.id);
      const second = finished.participants.find((participant) => participant.playerId === guest.player.id);
      assert.equal(winner?.score, 200);
      assert.equal(winner?.rank, 1);
      assert.equal(winner?.isWinner, true);
      assert.equal(second?.score, 50);
      assert.equal(second?.rank, 2);
      assert.equal(second?.isWinner, false);

      abortedId = (await beginPersistedMatch({
        roomId: extra.room.id,
        gameId: 'judge',
        participantPlayerIds: [extra.player.id],
      })) ?? undefined;
      assert.ok(abortedId);
      assert.equal(await abortPersistedMatch(extra.room.id), true);

      const aborted = await loadMatch(abortedId);
      assert.equal(aborted.status, MatchStatus.ABORTED);
      assert.ok(aborted.endedAt);
      assert.equal(aborted.participants[0]?.score, null);
      assert.equal(aborted.participants[0]?.rank, null);
      assert.equal(aborted.participants[0]?.isWinner, null);
    } finally {
      await cleanupMatch(completedId);
      await cleanupMatch(abortedId);
      await prisma.room.deleteMany({ where: { id: { in: [host.room.id, extra.room.id] } } }).catch(
        () => undefined,
      );
    }
  });

  await test('countdown cancel aborts the ACTIVE history row', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    let matchId: string | undefined;

    try {
      const init = await initGameShell(host.room.id, host.player.id, { gameId: 'who-wrote-it' });
      assert.equal(init.success, true, init.success ? '' : init.error.message);
      const started = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(started.success, true, started.success ? '' : started.error.message);

      const active = await prisma.match.findFirst({
        where: { roomId: host.room.id, status: MatchStatus.ACTIVE },
      });
      assert.ok(active);
      matchId = active.id;

      const cancelled = await cancelGameShellCountdown(host.room.id, host.player.id);
      assert.equal(cancelled.success, true, cancelled.success ? '' : cancelled.error.message);

      const after = await loadMatch(matchId);
      assert.equal(after.status, MatchStatus.ABORTED);
      assert.ok(after.endedAt);
    } finally {
      deleteGameShell(host.room.id);
      await cleanupMatch(matchId);
      await prisma.room.deleteMany({ where: { id: host.room.id } }).catch(() => undefined);
    }
  });

  await test('room delete keeps history and aborts leftover ACTIVE rows', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    let matchId: string | undefined;

    try {
      matchId = (await beginPersistedMatch({
        roomId: host.room.id,
        gameId: 'imposter-draw',
        participantPlayerIds: [host.player.id],
      })) ?? undefined;
      assert.ok(matchId);

      await deleteRoomWithRelations(host.room.id);

      const match = await loadMatch(matchId);
      assert.equal(match.status, MatchStatus.ABORTED);
      assert.equal(match.roomId, null);
      assert.equal(match.roomCode, host.room.code);
      assert.equal(match.participants.length, 1);
      assert.equal(match.participants[0]?.displayName, host.player.name);
      assert.equal(match.participants[0]?.playerId, null);
    } finally {
      await cleanupMatch(matchId);
    }
  });

  await test('startup reconciliation aborts leftover ACTIVE history rows', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    let matchId: string | undefined;

    try {
      matchId = (await beginPersistedMatch({
        roomId: host.room.id,
        gameId: 'timing-challenge',
        participantPlayerIds: [host.player.id],
      })) ?? undefined;
      assert.ok(matchId);

      const summary = await reconcilePersistedRoomLifecycle();
      assert.ok(summary.activeMatchesAborted >= 1);

      const match = await loadMatch(matchId);
      assert.equal(match.status, MatchStatus.ABORTED);
      assert.ok(match.endedAt);
      assert.equal(match.roomId, host.room.id);

      const abortedAgain = await abortAllActiveMatches();
      assert.equal(abortedAgain, 0);
    } finally {
      await cleanupMatch(matchId);
      await prisma.room.deleteMany({ where: { id: host.room.id } }).catch(() => undefined);
    }
  });

  await test('begin is idempotent for one ACTIVE match per room', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    let matchId: string | undefined;

    try {
      const first = await beginPersistedMatch({
        roomId: host.room.id,
        gameId: 'guessing-challenge',
        participantPlayerIds: [host.player.id],
      });
      const second = await beginPersistedMatch({
        roomId: host.room.id,
        gameId: 'guessing-challenge',
        participantPlayerIds: [host.player.id],
      });
      assert.ok(first);
      assert.equal(second, first);
      matchId = first;

      const count = await prisma.match.count({
        where: { roomId: host.room.id, status: MatchStatus.ACTIVE },
      });
      assert.equal(count, 1);
    } finally {
      await cleanupMatch(matchId);
      await prisma.room.deleteMany({ where: { id: host.room.id } }).catch(() => undefined);
    }
  });

  if (failed > 0) {
    console.error(`\n${failed} failed, ${passed} passed`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${passed} passed`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
