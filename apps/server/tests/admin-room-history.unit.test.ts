/**
 * Admin Batch 2 — paginated live rooms and durable room history.
 * Runs only with the automated-test database guard active.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchStatus, RoomCloseReason } from '@prisma/client';
import {
  ADMIN_LIVE_ROOMS_PAGE_SIZE,
  ADMIN_ROOM_HISTORY_PAGE_SIZE,
  type AdminRoomHistoryDetails,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { buildAdminLiveRoomsWhere } from '../src/modules/admin/admin-rooms.service.js';
import {
  buildAdminRoomHistoryWhere,
  getAdminRoomHistoryById,
  listAdminRoomHistory,
} from '../src/modules/admin/admin-room-history.service.js';
import { stopExpiredAuthSessionCleanup } from '../src/modules/auth/auth-session-cleanup.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
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

async function withApp(fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function assertNoSecretFields(value: unknown): void {
  const raw = JSON.stringify(value);
  assert.doesNotMatch(
    raw,
    /reconnectToken|tokenHash|passwordHash|encryptedSecret|recoveryCode|socketId|ipAddress/i,
  );
}

async function main(): Promise<void> {
  const prefix = `batch2-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const historyIds = Array.from({ length: 29 }, (_, index) => `${prefix}-h-${index}`);
  const createdAt = new Date('2026-01-10T12:00:00.000Z');
  const targetId = historyIds[0]!;
  const partialId = historyIds[1]!;
  const reusedCode = `${prefix}-reuse`;

  await test('new Admin endpoints require authorization and MFA-backed Admin middleware', async () => {
    const routesSource = readFileSync(join(root, 'src/modules/admin/admin.routes.ts'), 'utf8');
    assert.match(routesSource, /get\('\/room-history', requireAdmin/);
    assert.match(routesSource, /get\('\/room-history\/:historyId', requireAdmin/);
    await withApp(async (baseUrl) => {
      const list = await fetch(`${baseUrl}/api/admin/room-history`);
      const detail = await fetch(`${baseUrl}/api/admin/room-history/missing`);
      assert.equal(list.status, 401);
      assert.equal(detail.status, 401);
    });
  });

  await test('Live Rooms query is paginated, searchable, locked-filtered, and does not select players', () => {
    const where = buildAdminLiveRoomsWhere({ q: 'مشارك', locked: 'true' });
    assert.equal(where.isLocked, true);
    assert.ok(Array.isArray(where.OR));
    const source = readFileSync(join(root, 'src/modules/admin/admin-rooms.service.ts'), 'utf8');
    assert.match(source, /take: pageSize/);
    assert.match(source, /skip: \(page - 1\) \* pageSize/);
    assert.match(source, /orderBy: \[\{ createdAt: 'desc' \}, \{ id: 'desc' \}\]/);
    assert.match(source, /prisma\.player\.groupBy/);
    const listSelect = source.slice(
      source.indexOf('const ROOM_LIST_SELECT'),
      source.indexOf('const ROOM_DETAIL_SELECT'),
    );
    assert.doesNotMatch(listSelect, /players:/);
    assert.equal(ADMIN_LIVE_ROOMS_PAGE_SIZE, 25);
  });

  try {
    await prisma.roomHistory.createMany({
      data: historyIds.map((id, index) => ({
        id,
        liveRoomId: `${prefix}-live-${index}`,
        roomCode: index >= 27 ? reusedCode : `${prefix}-${String(index).padStart(2, '0')}`,
        originalHostName: index === 1 ? null : `Original ${index}`,
        currentHostPlayerId: `${prefix}-host-player-${index}`,
        currentHostName: index === 0 ? 'Final Host Search' : `Final ${index}`,
        playerCap: 8,
        isLocked: index % 2 === 0,
        wasEverLocked: index === 1 ? null : index % 2 === 0,
        createdByAdmin: index === 1 ? null : false,
        isComplete: index !== 1,
        createdAt: new Date(createdAt.getTime() + index * 86_400_000),
        historyStartedAt: new Date(
          createdAt.getTime() + index * 86_400_000 + (index === 1 ? 60_000 : 0),
        ),
        closedAt:
          index === 0 ? null : new Date(createdAt.getTime() + index * 86_400_000 + 3_600_000),
        closeReason: index === 0 ? null : RoomCloseReason.ROOM_EMPTY,
      })),
    });

    await prisma.roomParticipationHistory.createMany({
      data: [
        {
          roomHistoryId: targetId,
          livePlayerId: `${prefix}-participant-1`,
          displayName: 'Participant Search Name',
          joinedAt: createdAt,
          leftAt: null,
          joinedAsSpectator: false,
          wasHost: true,
        },
        {
          roomHistoryId: partialId,
          livePlayerId: `${prefix}-participant-2`,
          displayName: 'Partial Participant',
          joinedAt: new Date(createdAt.getTime() + 86_460_000),
          leftAt: null,
          joinedAsSpectator: null,
          wasHost: null,
        },
      ],
    });
    await prisma.roomHostHistory.create({
      data: {
        roomHistoryId: targetId,
        livePlayerId: `${prefix}-participant-1`,
        displayName: 'Final Host Search',
        assignedAt: createdAt,
      },
    });
    const match = await prisma.match.create({
      data: {
        roomHistoryId: targetId,
        roomCode: `${prefix}-00`,
        gameId: 'draw-guess',
        status: MatchStatus.COMPLETED,
        startedAt: createdAt,
        endedAt: new Date(createdAt.getTime() + 1_800_000),
        participants: {
          create: [
            { displayName: 'Participant Search Name', rank: 1, isWinner: true, score: 10 },
            { displayName: 'Other Player', rank: 2, isWinner: false, score: 5 },
          ],
        },
      },
    });

    await test('Room History pagination is deterministic and bounded', async () => {
      const first = await listAdminRoomHistory({ roomCode: prefix, page: 1 });
      const second = await listAdminRoomHistory({ roomCode: prefix, page: 2 });
      assert.equal(first.total, 29);
      assert.equal(first.pageSize, ADMIN_ROOM_HISTORY_PAGE_SIZE);
      assert.equal(first.rooms.length, 25);
      assert.equal(second.rooms.length, 4);
      assert.equal(new Set([...first.rooms, ...second.rooms].map((room) => room.id)).size, 29);
    });

    await test('room code, participant, host, game, date, and state filters are server-side', async () => {
      assert.equal((await listAdminRoomHistory({ roomCode: `${prefix}-00` })).total, 1);
      assert.equal(
        (await listAdminRoomHistory({ roomCode: prefix, participant: 'participant search' })).total,
        1,
      );
      assert.equal(
        (await listAdminRoomHistory({ roomCode: prefix, host: 'final host search' })).total,
        1,
      );
      assert.equal(
        (await listAdminRoomHistory({ roomCode: prefix, gameId: 'draw-guess' })).total,
        1,
      );
      assert.equal(
        (
          await listAdminRoomHistory({
            roomCode: prefix,
            createdFrom: '2026-01-10',
            createdTo: '2026-01-10',
          })
        ).total,
        1,
      );
      assert.equal(
        (await listAdminRoomHistory({ roomCode: `${prefix}-00`, state: 'OPEN' })).total,
        1,
      );
      assert.equal(
        (await listAdminRoomHistory({ roomCode: `${prefix}-00`, state: 'CLOSED' })).total,
        0,
      );
    });

    await test('complete and partial histories remain explicit', async () => {
      const complete = await listAdminRoomHistory({ roomCode: `${prefix}-00` });
      const partial = await listAdminRoomHistory({ roomCode: `${prefix}-01` });
      assert.equal(complete.rooms[0]?.isComplete, true);
      assert.equal(partial.rooms[0]?.isComplete, false);
      assert.equal(partial.rooms[0]?.originalHostName, null);
      assert.notEqual(partial.rooms[0]?.historyStartedAt, partial.rooms[0]?.createdAt);
    });

    await test('historical detail exposes participants, host timeline, Match linkage, and safe result summary', async () => {
      const result = await getAdminRoomHistoryById(targetId);
      assert.equal(result.success, true);
      if (!result.success) {
        return;
      }
      const detail: AdminRoomHistoryDetails = result.data;
      assert.equal(detail.participants.length, 1);
      assert.equal(detail.participants[0]?.displayName, 'Participant Search Name');
      assert.equal(detail.hostAssignments.length, 1);
      assert.equal(detail.matches.length, 1);
      assert.equal(detail.matches[0]?.id, match.id);
      assert.deepEqual(detail.matches[0]?.winnerDisplayNames, ['Participant Search Name']);
      assertNoSecretFields(detail);
    });

    await test('room-code reuse stays as separate permanent histories', async () => {
      const reused = await listAdminRoomHistory({ roomCode: reusedCode });
      assert.equal(reused.total, 2);
      assert.equal(new Set(reused.rooms.map((room) => room.id)).size, 2);
    });

    await test('nonexistent history ID returns a bounded not-found response', async () => {
      const result = await getAdminRoomHistoryById(`${prefix}-missing`);
      assert.equal(result.success, false);
      assert.equal(!result.success && result.error.code, 'ROOM_HISTORY_NOT_FOUND');
      assertNoSecretFields(result);
    });

    await test('query builders do not infer old Matches by room code', () => {
      const where = buildAdminRoomHistoryWhere({ roomCode: reusedCode, participant: 'Someone' });
      const raw = JSON.stringify(where);
      assert.match(raw, /participations/);
      assert.doesNotMatch(raw, /roomHistoryId.*null|MatchWhereInput/);
    });
  } finally {
    await prisma.match.deleteMany({ where: { roomHistoryId: { in: historyIds } } });
    await prisma.roomHistory.deleteMany({ where: { id: { in: historyIds } } });
    stopExpiredAuthSessionCleanup();
  }

  await prisma.$disconnect();
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  stopExpiredAuthSessionCleanup();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
