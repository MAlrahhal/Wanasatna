/**
 * P12-B.7.2 — remove legacy Session / ChatMessage / dead Room columns.
 * Run: pnpm --filter @wanasatna/server test:p12-b72
 *
 * Does not apply prisma migrate deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchStatus, PlayerStatus, Prisma } from '@prisma/client';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import {
  deleteGameShell,
  initGameShell,
  startGameShellCountdown,
} from '../src/modules/game/game.service.js';
import { completePersistedMatch } from '../src/modules/match/match-history.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import {
  handlePlayerDisconnect,
  kickPlayer,
  leaveRoom,
} from '../src/modules/room/services/leave-room.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';
import { deleteRoomWithRelations } from '../src/modules/room/services/room-cleanup.service.js';
import { MAX_ROOM_PLAYERS } from '../src/modules/room/room.utils.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION = 'prisma/migrations/20260816240000_remove_legacy_session_and_chat/migration.sql';

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
  return `p12b72.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
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
  await test('schema: legacy Session/ChatMessage/session columns and enums are gone', () => {
    const schema = read('prisma/schema.prisma');
    assert.doesNotMatch(schema, /model Session \{/);
    assert.doesNotMatch(schema, /model ChatMessage \{/);
    assert.doesNotMatch(schema, /activeSessionId/);
    assert.doesNotMatch(schema, /sessionType/);
    assert.doesNotMatch(schema, /enum SessionType \{/);
    assert.doesNotMatch(schema, /enum SessionStatus \{/);
    assert.doesNotMatch(schema, /enum ChatMessageType \{/);
    assert.equal('session' in prisma, false);
    assert.equal('chatMessage' in prisma, false);
    assert.equal(typeof prisma.authSession, 'object');
    assert.equal(typeof prisma.match, 'object');
    assert.equal(typeof prisma.matchParticipant, 'object');
    assert.equal(MAX_ROOM_PLAYERS, 8);
  });

  await test('schema: Auth, Match, RoomStatus, isSpectator, Player.userId preserved', () => {
    const schema = read('prisma/schema.prisma');
    assert.match(schema, /model AuthSession \{/);
    assert.match(schema, /model Match \{/);
    assert.match(schema, /model MatchParticipant \{/);
    assert.match(schema, /enum RoomStatus \{\s*LOBBY\s*PLAYING\s*CLOSED\s*\}/);
    assert.match(schema, /isSpectator\s+Boolean\s+@default\(false\)/);
    assert.match(schema, /userId\s+String\?/);
    assert.doesNotMatch(schema, /enum RoomStatus \{[\s\S]*DROP/);
  });

  await test('migration SQL targets only approved legacy objects', () => {
    const sql = read(MIGRATION);
    assert.match(sql, /DROP TABLE "ChatMessage";/);
    assert.match(sql, /DROP TABLE "Session";/);
    assert.match(sql, /DROP COLUMN "activeSessionId"/);
    assert.match(sql, /DROP COLUMN "sessionType"/);
    assert.match(sql, /DROP TYPE "ChatMessageType";/);
    assert.match(sql, /DROP TYPE "SessionStatus";/);
    assert.match(sql, /DROP TYPE "SessionType";/);
    assert.match(sql, /DROP INDEX "Room_activeSessionId_key";/);
    assert.match(sql, /DROP CONSTRAINT "ChatMessage_playerId_fkey"/);
    assert.match(sql, /DROP CONSTRAINT "ChatMessage_roomId_fkey"/);
    assert.match(sql, /DROP CONSTRAINT "Session_roomId_fkey"/);
    assert.match(sql, /DROP CONSTRAINT "Room_activeSessionId_fkey"/);
    const executable = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    assert.doesNotMatch(executable, /DROP TABLE "Room"/);
    assert.doesNotMatch(executable, /DROP TABLE "Player"/);
    assert.doesNotMatch(executable, /DROP TABLE "User"/);
    assert.doesNotMatch(executable, /DROP TABLE "AuthSession"/);
    assert.doesNotMatch(executable, /DROP TABLE "Match"/);
    assert.doesNotMatch(executable, /DROP TABLE "MatchParticipant"/);
    assert.doesNotMatch(executable, /DROP TYPE "RoomStatus"/);
    assert.doesNotMatch(executable, /DROP TYPE "MatchStatus"/);
    assert.doesNotMatch(executable, /DROP TYPE "UserRole"/);
    assert.doesNotMatch(executable, /DROP TYPE "PlayerStatus"/);
    assert.doesNotMatch(executable, /isSpectator/);
    assert.doesNotMatch(executable, /passwordHash/);
    assert.doesNotMatch(executable, /CREATE TABLE/);
    assert.doesNotMatch(executable, /CREATE TYPE/);
    assert.doesNotMatch(executable, /TRUNCATE/);
    assert.doesNotMatch(executable, /DELETE FROM/);

    const dropTables = [...sql.matchAll(/DROP TABLE "([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(dropTables.sort(), ['ChatMessage', 'Session']);
    const dropTypes = [...sql.matchAll(/DROP TYPE "([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(dropTypes.sort(), ['ChatMessageType', 'SessionStatus', 'SessionType']);
    const dropColumns = [...sql.matchAll(/DROP COLUMN "([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(dropColumns.sort(), ['activeSessionId', 'sessionType']);
  });

  await test('source: create/cleanup no longer touch Session or activeSessionId', () => {
    const create = read('src/modules/room/services/create-room.service.ts');
    assert.doesNotMatch(create, /SessionType/);
    assert.doesNotMatch(create, /sessionType/);
    assert.doesNotMatch(create, /activeSessionId/);

    const cleanup = read('src/modules/room/services/room-cleanup.service.ts');
    assert.doesNotMatch(cleanup, /activeSessionId/);
    assert.match(cleanup, /client\.room\.delete/);
    assert.match(cleanup, /MatchStatus\.ACTIVE/);

    const utils = read('src/modules/room/room.utils.ts');
    assert.doesNotMatch(utils, /sessionType/);
    assert.doesNotMatch(utils, /activeSessionId/);
  });

  await test('create / join / leave / kick / host transfer / reconnect', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    assert.equal(host.room.status, 'LOBBY');
    assert.equal('sessionType' in host.room, false);
    assert.equal('activeSessionId' in host.room, false);

    const kicked = await kickPlayer(host.player.id, host.room.id, { playerId: guest.player.id });
    assert.equal(kicked.success, true, kicked.success ? '' : kicked.error.message);

    const successor = await mustJoin(host.room.code, uniqueName('وريث'));
    const hostLeft = await leaveRoom(host.player.id, host.room.id);
    assert.equal(hostLeft.success, true, hostLeft.success ? '' : hostLeft.error.message);
    if (!hostLeft.success) {
      throw new Error(hostLeft.error.message);
    }
    assert.equal(hostLeft.data.roomDeleted, false);
    assert.equal(hostLeft.data.hostChanged?.hostPlayerId, successor.player.id);

    await handlePlayerDisconnect(successor.player.id, successor.room.id);
    const resumed = await reconnectPlayer({
      playerId: successor.player.id,
      reconnectToken: successor.reconnectToken,
      roomId: successor.room.id,
      roomCode: successor.room.code,
    });
    assert.equal(resumed.success, true, resumed.success ? '' : resumed.error.message);
    if (!resumed.success) {
      throw new Error(resumed.error.message);
    }
    assert.equal(resumed.data.player.id, successor.player.id);
    assert.equal(resumed.data.player.status, PlayerStatus.CONNECTED);
    assert.equal(resumed.data.player.isHost, true);

    const last = await leaveRoom(successor.player.id, successor.room.id);
    assert.equal(last.success, true, last.success ? '' : last.error.message);
    if (last.success) {
      assert.equal(last.data.roomDeleted, true);
    }
  });

  await test('account-linked Player.userId still set on create', async () => {
    const email = uniqueEmail('link');
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
      const row = await prisma.player.findUnique({ where: { id: host.player.id } });
      assert.equal(row?.userId, registered.data.user.id);
      assert.equal(row?.isSpectator, false);
      await leaveRoom(host.player.id, host.room.id);
    } finally {
      await cleanupEmail(email);
    }
  });

  await test('room delete preserves Match history via SetNull', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    let matchId: string | undefined;
    try {
      matchId =
        (
          await prisma.match.create({
            data: {
              roomId: host.room.id,
              roomCode: host.room.code,
              gameId: 'draw-guess',
              status: MatchStatus.ACTIVE,
              participants: {
                create: {
                  playerId: host.player.id,
                  displayName: host.player.name,
                },
              },
            },
          })
        ).id;

      await deleteRoomWithRelations(host.room.id);
      const match = await loadMatch(matchId);
      assert.equal(match.status, MatchStatus.ABORTED);
      assert.equal(match.roomId, null);
      assert.equal(match.roomCode, host.room.code);
      assert.equal(match.participants[0]?.playerId, null);
      assert.equal(await prisma.room.findUnique({ where: { id: host.room.id } }), null);
    } finally {
      await cleanupMatch(matchId);
    }
  });

  await test('Game A → Game B writes separate Match history rows', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    let firstId: string | undefined;
    let secondId: string | undefined;
    try {
      const initA = await initGameShell(host.room.id, host.player.id, { gameId: 'bara-al-salafa' });
      assert.equal(initA.success, true, initA.success ? '' : initA.error.message);
      const startedA = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(startedA.success, true, startedA.success ? '' : startedA.error.message);

      const first = await prisma.match.findFirst({
        where: { roomId: host.room.id, status: MatchStatus.ACTIVE },
      });
      assert.ok(first);
      firstId = first.id;
      assert.equal(first.gameId, 'bara-al-salafa');
      await completePersistedMatch(host.room.id, [
        { playerId: host.player.id, score: 1, rank: 1, isWinner: true },
        { playerId: guest.player.id, score: 0, rank: 2, isWinner: false },
      ]);
      deleteGameShell(host.room.id);

      const initB = await initGameShell(host.room.id, host.player.id, { gameId: 'draw-guess' });
      assert.equal(initB.success, true, initB.success ? '' : initB.error.message);
      const startedB = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(startedB.success, true, startedB.success ? '' : startedB.error.message);

      const second = await prisma.match.findFirst({
        where: { roomId: host.room.id, status: MatchStatus.ACTIVE },
      });
      assert.ok(second);
      secondId = second.id;
      assert.equal(second.gameId, 'draw-guess');
      assert.notEqual(secondId, firstId);

      const completedA = await loadMatch(firstId);
      assert.equal(completedA.status, MatchStatus.COMPLETED);
    } finally {
      deleteGameShell(host.room.id);
      await cleanupMatch(firstId);
      await cleanupMatch(secondId);
      await prisma.room.deleteMany({ where: { id: host.room.id } }).catch(() => undefined);
    }
  });

  await test('pre-deploy Neon inventory is still empty for legacy objects', async () => {
    const [sessionCount] = await prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "Session"`,
    );
    const [chatCount] = await prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "ChatMessage"`,
    );
    const [activeCount] = await prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "Room" WHERE "activeSessionId" IS NOT NULL`,
    );
    assert.equal(Number(sessionCount?.count ?? -1), 0);
    assert.equal(Number(chatCount?.count ?? -1), 0);
    assert.equal(Number(activeCount?.count ?? -1), 0);
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
