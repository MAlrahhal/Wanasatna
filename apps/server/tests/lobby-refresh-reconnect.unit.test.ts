/**
 * Lobby refresh: temporary disconnect must restore the same seat without
 * permanent leave, host transfer, room cleanup, or a duplicate player.
 *
 * Run: pnpm --filter @wanasatna/server exec tsx tests/lobby-refresh-reconnect.unit.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerStatus } from '@prisma/client';
import type { Server } from 'socket.io';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { loadActiveRoomPlayers, RECONNECT_WINDOW_MS } from '../src/modules/room/room.utils.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { expireDisconnectedPlayer } from '../src/modules/room/services/disconnected-player-expiry.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { applySocketDisconnectPresence } from '../src/modules/room/services/presence-disconnect.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';

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

async function cleanupRoom(roomId: string | undefined): Promise<void> {
  if (!roomId) {
    return;
  }
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
}

function mockIo(
  socketsByCall: Array<Array<{ id: string; data: { playerId?: string; roomId?: string } }>> = [[]],
): Server {
  let call = 0;
  return {
    in: () => ({
      fetchSockets: async () => {
        const index = Math.min(call, socketsByCall.length - 1);
        call += 1;
        return socketsByCall[index] ?? [];
      },
    }),
  } as unknown as Server;
}

function assertSingleSeat(
  roster: Awaited<ReturnType<typeof loadActiveRoomPlayers>>,
  playerId: string,
): void {
  assert.equal(roster.filter((entry) => entry.id === playerId).length, 1);
}

async function main(): Promise<void> {
  await test('source: lobby socket disconnect does not transfer host or permanently leave', () => {
    const handlers = read('src/modules/room/room.socket.handlers.ts');
    const disconnectFn = handlers.slice(handlers.indexOf('export function registerDisconnectHandler'));
    assert.match(disconnectFn, /applySocketDisconnectPresence/);
    assert.doesNotMatch(disconnectFn, /transferHostIfCurrentHostDisconnected/);
    assert.doesNotMatch(disconnectFn, /permanentlyDepartPlayer/);
    assert.doesNotMatch(disconnectFn, /expireDisconnectedPlayer/);

    const disconnectWrite = read('src/modules/room/services/leave-room.service.ts');
    const disconnectOnly = disconnectWrite.slice(
      disconnectWrite.indexOf('export async function handlePlayerDisconnect'),
    );
    assert.match(disconnectOnly, /PlayerStatus\.DISCONNECTED/);
    assert.doesNotMatch(disconnectOnly, /PlayerStatus\.LEFT/);
    assert.doesNotMatch(disconnectOnly, /permanentlyDepartPlayer/);
  });

  await test(
    'lobby guest refresh: disconnect handling + reconnect within grace restores the same identity',
    async () => {
      const host = await mustCreate(uniqueName('مضيف'));
      const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
      const roomId = guest.room.id;

      try {
        const presence = await applySocketDisconnectPresence(
          mockIo(),
          guest.player.id,
          roomId,
          'old-socket',
        );
        assert.equal(presence, 'disconnected');

        const disconnected = await prisma.player.findUnique({ where: { id: guest.player.id } });
        assert.equal(disconnected?.status, PlayerStatus.DISCONNECTED);
        assert.ok(disconnected?.reconnectTokenHash);

        const midRoster = await loadActiveRoomPlayers(roomId, host.player.id);
        assert.equal(midRoster.length, 2);
        assertSingleSeat(midRoster, guest.player.id);
        assert.equal(midRoster.find((entry) => entry.id === guest.player.id)?.status, 'DISCONNECTED');
        assert.equal(midRoster.find((entry) => entry.id === host.player.id)?.isHost, true);
        assert.equal((await prisma.room.findUnique({ where: { id: roomId } }))?.hostPlayerId, host.player.id);
        assert.ok(await prisma.room.findUnique({ where: { id: roomId } }));

        const recon = await reconnectPlayer({
          playerId: guest.player.id,
          reconnectToken: guest.reconnectToken,
          roomId,
          roomCode: guest.room.code,
        });
        assert.equal(recon.success, true);
        if (!recon.success) {
          throw new Error(recon.error.message);
        }

        assert.equal(recon.data.player.id, guest.player.id);
        assert.equal(recon.data.player.status, 'CONNECTED');
        assert.equal(recon.data.player.isHost, false);
        assert.equal(recon.data.room.hostPlayerId, host.player.id);
        assertSingleSeat(recon.data.players, guest.player.id);
        assert.equal(recon.data.players.length, 2);

        const sameName = await prisma.player.findMany({
          where: { roomId, name: guest.player.name },
        });
        assert.equal(sameName.length, 1);

        const history = await prisma.roomParticipationHistory.findMany({
          where: { livePlayerId: guest.player.id },
        });
        assert.equal(history.length, 1);
        assert.equal(history[0]?.leftAt, null);
      } finally {
        await cleanupRoom(roomId);
      }
    },
  );

  await test(
    'lobby host refresh: temporary disconnect does not transfer host; reconnect keeps the same host',
    async () => {
      const host = await mustCreate(uniqueName('مضيف'));
      const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
      const roomId = host.room.id;

      try {
        const presence = await applySocketDisconnectPresence(
          mockIo(),
          host.player.id,
          roomId,
          'old-socket',
        );
        assert.equal(presence, 'disconnected');

        const hostRow = await prisma.player.findUnique({ where: { id: host.player.id } });
        assert.equal(hostRow?.status, PlayerStatus.DISCONNECTED);

        const roomAfterDisconnect = await prisma.room.findUnique({ where: { id: roomId } });
        assert.equal(roomAfterDisconnect?.hostPlayerId, host.player.id);
        assert.ok(roomAfterDisconnect);

        const midRoster = await loadActiveRoomPlayers(roomId, host.player.id);
        assert.equal(midRoster.length, 2);
        assertSingleSeat(midRoster, host.player.id);
        assert.equal(midRoster.find((entry) => entry.id === host.player.id)?.isHost, true);
        assert.equal(midRoster.find((entry) => entry.id === guest.player.id)?.isHost, false);

        const recon = await reconnectPlayer({
          playerId: host.player.id,
          reconnectToken: host.reconnectToken,
          roomId,
          roomCode: host.room.code,
        });
        assert.equal(recon.success, true);
        if (!recon.success) {
          throw new Error(recon.error.message);
        }

        assert.equal(recon.data.player.id, host.player.id);
        assert.equal(recon.data.player.status, 'CONNECTED');
        assert.equal(recon.data.player.isHost, true);
        assert.equal(recon.data.room.hostPlayerId, host.player.id);
        assertSingleSeat(recon.data.players, host.player.id);
        assert.equal(recon.data.players.filter((entry) => entry.isHost).length, 1);
      } finally {
        await cleanupRoom(roomId);
      }
    },
  );

  await test(
    'genuine host expiry after the reconnect grace period still transfers host',
    async () => {
      const host = await mustCreate(uniqueName('مضيف'));
      const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
      const roomId = host.room.id;

      try {
        const presence = await applySocketDisconnectPresence(
          mockIo(),
          host.player.id,
          roomId,
          'old-socket',
        );
        assert.equal(presence, 'disconnected');

        await prisma.player.update({
          where: { id: host.player.id },
          data: { lastSeenAt: new Date(Date.now() - RECONNECT_WINDOW_MS - 1_000) },
        });

        const expired = await expireDisconnectedPlayer(host.player.id, roomId);
        assert.ok(expired);
        assert.equal(expired.roomDeleted, false);
        assert.equal(expired.hostChanged?.hostPlayerId, guest.player.id);

        const hostRow = await prisma.player.findUnique({ where: { id: host.player.id } });
        assert.equal(hostRow?.status, PlayerStatus.LEFT);
        assert.equal(hostRow?.reconnectTokenHash, null);

        const room = await prisma.room.findUnique({ where: { id: roomId } });
        assert.equal(room?.hostPlayerId, guest.player.id);

        const roster = await loadActiveRoomPlayers(roomId, guest.player.id);
        assert.equal(roster.length, 1);
        assert.equal(roster[0]?.id, guest.player.id);
        assert.equal(roster[0]?.isHost, true);
      } finally {
        await cleanupRoom(roomId);
      }
    },
  );

  await prisma.$disconnect();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
