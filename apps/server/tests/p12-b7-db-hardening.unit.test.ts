/**
 * P12-B.7.1 — non-destructive DB hardening: LEFT rejoin lock, indexes, retention.
 * Run: pnpm --filter @wanasatna/server test:p12-b7
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchStatus, PlayerStatus } from '@prisma/client';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { purgeExpiredAuthSessions } from '../src/modules/auth/auth-session-cleanup.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import { hashSessionToken } from '../src/modules/auth/session-token.js';
import { beginPersistedMatch } from '../src/modules/match/match-history.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { leaveRoom } from '../src/modules/room/services/leave-room.service.js';
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
  return `p12b7.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
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

async function registerAccount(prefix: string) {
  const email = uniqueEmail(prefix);
  const registered = await registerUser({
    email,
    password: 'password-ok',
    preferredDisplayName: uniqueName('اسم'),
  });
  assert.equal(registered.success, true);
  if (!registered.success) {
    throw new Error(registered.error.message);
  }
  return { email, user: registered.data.user, session: registered.session };
}

async function main(): Promise<void> {
  await test('source: B.7.1 additive indexes only; no DROP TABLE/COLUMN', () => {
    const schema = read('prisma/schema.prisma');
    assert.match(schema, /@@index\(\[status,\s*lastSeenAt\]\)/);
    assert.match(schema, /model AuthSession \{[\s\S]*@@index\(\[expiresAt\]\)/);
    assert.equal(MAX_ROOM_PLAYERS, 8);

    const migration = read(
      'prisma/migrations/20260816230000_add_expiry_and_auth_session_indexes/migration.sql',
    );
    assert.match(migration, /CREATE INDEX "Player_status_lastSeenAt_idx"/);
    assert.match(migration, /CREATE INDEX "AuthSession_expiresAt_idx"/);
    assert.doesNotMatch(migration, /DROP TABLE/);
    assert.doesNotMatch(migration, /DROP COLUMN/);
    assert.doesNotMatch(migration, /TRUNCATE/);
  });

  await test('source: join locks Room; P2002 mapped; expiry query unchanged', () => {
    const join = read('src/modules/room/services/join-room.service.ts');
    assert.match(join, /lockRoomRow/);
    assert.match(join, /ROOM_TX_RETRY_LIMIT/);
    assert.match(join, /P2002/);
    assert.match(join, /PLAYER_ALREADY_EXISTS/);
    assert.match(join, /accountUserId \|\| null/);
    assert.doesNotMatch(join, /existingPlayer\.userId/);

    const expiry = read('src/modules/room/services/disconnected-player-expiry.service.ts');
    assert.match(expiry, /status:\s*PlayerStatus\.DISCONNECTED/);
    assert.match(expiry, /lastSeenAt:\s*\{\s*lt:/);

    const indexSource = read('src/index.ts');
    const reconcileAt = indexSource.indexOf('await reconcilePersistedRoomLifecycle');
    const purgeAt = indexSource.indexOf('await purgeExpiredAuthSessions');
    const listenAt = indexSource.indexOf('httpServer.listen');
    assert.ok(reconcileAt >= 0 && purgeAt > reconcileAt && listenAt > purgeAt);
    assert.match(indexSource, /startup-expired-purge-failed/);
    assert.doesNotMatch(
      indexSource.slice(purgeAt, listenAt),
      /process\.exit\(1\)/,
    );
  });

  await test('LEFT same-name rejoin replaces the seat and does not copy userId', async () => {
    const emailA = uniqueEmail('lefta');
    const emailB = uniqueEmail('leftb');
    let roomId: string | undefined;

    try {
      const userA = await registerUser({
        email: emailA,
        password: 'password-ok',
        preferredDisplayName: uniqueName('أ'),
      });
      const userB = await registerUser({
        email: emailB,
        password: 'password-ok',
        preferredDisplayName: uniqueName('ب'),
      });
      assert.equal(userA.success, true);
      assert.equal(userB.success, true);
      if (!userA.success || !userB.success) {
        throw new Error('register failed');
      }

      const sharedName = uniqueName('سامي');
      const host = await mustCreate(uniqueName('مضيف'));
      roomId = host.room.id;
      const first = await mustJoin(host.room.code, sharedName, userA.data.user.id);
      const firstRow = await prisma.player.findUnique({ where: { id: first.player.id } });
      assert.equal(firstRow?.userId, userA.data.user.id);

      const left = await leaveRoom(first.player.id, host.room.id);
      assert.equal(left.success, true);
      const leftRow = await prisma.player.findUnique({ where: { id: first.player.id } });
      assert.equal(leftRow?.status, PlayerStatus.LEFT);

      const second = await mustJoin(host.room.code, sharedName, userB.data.user.id);
      assert.notEqual(second.player.id, first.player.id);
      assert.equal(await prisma.player.findUnique({ where: { id: first.player.id } }), null);
      const row = await prisma.player.findUnique({ where: { id: second.player.id } });
      assert.equal(row?.userId, userB.data.user.id);
      assert.equal(row?.name, sharedName);
      assert.equal(row?.status, PlayerStatus.CONNECTED);

      const guestName = uniqueName('ضيف');
      const guest = await mustJoin(host.room.code, guestName);
      await leaveRoom(guest.player.id, host.room.id);
      const guestAgain = await mustJoin(host.room.code, guestName);
      const guestRow = await prisma.player.findUnique({ where: { id: guestAgain.player.id } });
      assert.equal(guestRow?.userId, null);
      assert.notEqual(guestAgain.player.id, guest.player.id);
    } finally {
      if (roomId) {
        await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
      }
      await cleanupEmail(emailA);
      await cleanupEmail(emailB);
    }
  });

  await test('concurrent same-name JOIN yields one seat and a public conflict', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const name = uniqueName('توأ');

    try {
      const [first, second] = await Promise.all([
        joinRoom({ roomCode: host.room.code, playerName: name }),
        joinRoom({ roomCode: host.room.code, playerName: name }),
      ]);

      const outcomes = [first, second];
      const successes = outcomes.filter((outcome) => outcome.success);
      const failures = outcomes.filter((outcome) => !outcome.success);
      assert.equal(successes.length, 1);
      assert.equal(failures.length, 1);
      assert.equal(failures[0]?.success, false);
      if (!failures[0]?.success) {
        assert.equal(failures[0].error.code, 'PLAYER_ALREADY_EXISTS');
      }

      const seats = await prisma.player.findMany({
        where: { roomId: host.room.id, name },
      });
      assert.equal(seats.length, 1);
      assert.equal(seats[0]?.status, PlayerStatus.CONNECTED);
    } finally {
      await prisma.room.deleteMany({ where: { id: host.room.id } }).catch(() => undefined);
    }
  });

  await test('concurrent LEFT same-name rejoin still produces one seat', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const name = uniqueName('عاد');

    try {
      const prior = await mustJoin(host.room.code, name);
      const left = await leaveRoom(prior.player.id, host.room.id);
      assert.equal(left.success, true);

      const [first, second] = await Promise.all([
        joinRoom({ roomCode: host.room.code, playerName: name }),
        joinRoom({ roomCode: host.room.code, playerName: name }),
      ]);

      const successes = [first, second].filter((outcome) => outcome.success);
      const failures = [first, second].filter((outcome) => !outcome.success);
      assert.equal(successes.length, 1);
      assert.equal(failures.length, 1);
      if (!failures[0]?.success) {
        assert.equal(failures[0].error.code, 'PLAYER_ALREADY_EXISTS');
      }

      const seats = await prisma.player.findMany({
        where: { roomId: host.room.id, name },
      });
      assert.equal(seats.length, 1);
      assert.notEqual(seats[0]?.id, prior.player.id);
    } finally {
      await prisma.room.deleteMany({ where: { id: host.room.id } }).catch(() => undefined);
    }
  });

  await test('connected/disconnected name stays protected', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const name = uniqueName('محمي');

    try {
      await mustJoin(host.room.code, name);
      const again = await joinRoom({ roomCode: host.room.code, playerName: name });
      assert.equal(again.success, false);
      if (!again.success) {
        assert.equal(again.error.code, 'PLAYER_ALREADY_EXISTS');
      }
    } finally {
      await prisma.room.deleteMany({ where: { id: host.room.id } }).catch(() => undefined);
    }
  });

  await test('AuthSession purge removes expired rows only', async () => {
    const account = await registerAccount('purge');
    try {
      assert.ok(account.session);
      const liveHash = hashSessionToken(account.session.sessionToken);
      await prisma.authSession.create({
        data: {
          userId: account.user.id,
          tokenHash: `expired.${account.user.id}.${Date.now()}`,
          expiresAt: new Date(Date.now() - 60_000),
        },
      });

      const purged = await purgeExpiredAuthSessions();
      assert.ok(purged >= 1);

      const remaining = await prisma.authSession.findMany({
        where: { userId: account.user.id },
      });
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0]?.tokenHash, liveHash);
    } finally {
      await cleanupEmail(account.email);
    }
  });

  await test('LEFT rejoin does not erase Match history; user delete SetNulls participant.userId', async () => {
    const account = await registerAccount('hist');
    const host = await mustCreate(uniqueName('مضيف'), account.user.id);
    const guestName = uniqueName('لاعب');
    const guest = await mustJoin(host.room.code, guestName);
    let matchId: string | undefined;

    try {
      matchId = (await beginPersistedMatch({
        roomId: host.room.id,
        gameId: 'fast-answer',
        participantPlayerIds: [host.player.id, guest.player.id],
      })) ?? undefined;
      assert.ok(matchId);

      const left = await leaveRoom(guest.player.id, host.room.id);
      assert.equal(left.success, true);

      const rejoined = await mustJoin(host.room.code, guestName);
      assert.notEqual(rejoined.player.id, guest.player.id);

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { participants: true },
      });
      assert.ok(match);
      assert.equal(match.status, MatchStatus.ACTIVE);
      assert.equal(match.participants.length, 2);
      const departed = match.participants.find(
        (participant) => participant.displayName === guest.player.name,
      );
      assert.equal(departed?.playerId, null);
      assert.equal(departed?.userId, null);

      await prisma.user.delete({ where: { id: account.user.id } });
      const afterUserDelete = await prisma.match.findUnique({
        where: { id: matchId },
        include: { participants: true },
      });
      assert.ok(afterUserDelete);
      const hostParticipant = afterUserDelete.participants.find(
        (participant) => participant.displayName === host.player.name,
      );
      assert.equal(hostParticipant?.userId, null);
    } finally {
      await cleanupMatch(matchId);
      await prisma.room.deleteMany({ where: { id: host.room.id } }).catch(() => undefined);
      await cleanupEmail(account.email);
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
