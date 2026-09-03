/**
 * Room Host transfers immediately when the current Host is confirmed DISCONNECTED.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/host-disconnect-transfer.unit.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerStatus } from '@prisma/client';
import type { Server } from 'socket.io';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  deleteGameShell,
  getGameShellByRoomId,
  replaceGameShellForTests,
  type GameShellRecord,
} from '../src/modules/game/game.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { transferHostIfCurrentHostDisconnected } from '../src/modules/room/services/host.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { handlePlayerDisconnect, leaveRoom } from '../src/modules/room/services/leave-room.service.js';
import { applySocketDisconnectPresence } from '../src/modules/room/services/presence-disconnect.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';
import { loadActiveRoomPlayers } from '../src/modules/room/room.utils.js';

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
  deleteGameShell(roomId);
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
}

function mockIo(
  socketsByCall: Array<Array<{ id: string; data: { playerId?: string; roomId?: string } }>>,
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

async function confirmDisconnectThenTransfer(
  playerId: string,
  roomId: string,
  io: Server = mockIo([[]]),
) {
  const presence = await applySocketDisconnectPresence(io, playerId, roomId, 'old-socket');
  const hostChanged =
    presence === 'disconnected'
      ? await transferHostIfCurrentHostDisconnected(roomId, playerId)
      : null;
  return { presence, hostChanged };
}

function playingShell(input: {
  roomId: string;
  hostId: string;
  hostName: string;
  guestId: string;
  guestName: string;
}): GameShellRecord {
  return {
    shellId: 'shell-host-disconnect',
    roomId: input.roomId,
    gameId: 'fast-answer',
    phase: 'PLAYING',
    hostPlayerId: input.hostId,
    players: [
      {
        id: input.hostId,
        name: input.hostName,
        isHost: true,
        isConnected: true,
        isReady: true,
        isSpectator: false,
      },
      {
        id: input.guestId,
        name: input.guestName,
        isHost: false,
        isConnected: true,
        isReady: true,
        isSpectator: false,
      },
    ],
    readyPlayerIds: [input.hostId, input.guestId],
    countdownSeconds: 3,
    countdownRemainingSeconds: null,
    gameTimerSeconds: 60,
    gameTimerRemainingSeconds: 42,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-01-01T00:00:10.000Z',
    matchParticipantIds: [input.hostId, input.guestId],
  };
}

async function main(): Promise<void> {
  await test('source: disconnect transfers host only after confirmed DISCONNECTED', () => {
    const handlers = read('src/modules/room/room.socket.handlers.ts');
    const disconnectFn = handlers.slice(handlers.indexOf('export function registerDisconnectHandler'));
    assert.match(disconnectFn, /applySocketDisconnectPresence/);
    assert.match(disconnectFn, /presence !== 'disconnected'/);
    assert.match(disconnectFn, /transferHostIfCurrentHostDisconnected/);
    assert.match(disconnectFn, /HOST_CHANGED_EVENT/);

    const presence = read('src/modules/room/services/presence-disconnect.service.ts');
    assert.doesNotMatch(presence, /transferHost/);

    const disconnectWrite = read('src/modules/room/services/leave-room.service.ts');
    const disconnectOnly = disconnectWrite.slice(
      disconnectWrite.indexOf('export async function handlePlayerDisconnect'),
    );
    assert.doesNotMatch(disconnectOnly, /transferHost/);
    assert.doesNotMatch(disconnectOnly, /permanentlyDepartPlayer/);

    const hostService = read('src/modules/room/services/host.service.ts');
    assert.match(hostService, /recordRoomHostTransfer/);
    assert.match(hostService, /selectNextHostPlayer|findNextHostPlayer/);
  });

  await test('A: host disconnect with 2 connected players transfers host immediately', async () => {
    const host = await mustCreate(uniqueName('محمد'));
    const guest = await mustJoin(host.room.code, uniqueName('أحمد'));

    const { presence, hostChanged } = await confirmDisconnectThenTransfer(
      host.player.id,
      host.room.id,
    );
    assert.equal(presence, 'disconnected');
    assert.equal(hostChanged?.hostPlayerId, guest.player.id);

    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, guest.player.id);

    const hostRow = await prisma.player.findUnique({ where: { id: host.player.id } });
    assert.equal(hostRow?.status, PlayerStatus.DISCONNECTED);
    assert.ok(hostRow?.reconnectTokenHash);

    const roster = await loadActiveRoomPlayers(host.room.id, room!.hostPlayerId);
    assert.equal(roster.length, 2);
    assert.equal(roster.find((entry) => entry.id === host.player.id)?.isHost, false);
    assert.equal(roster.find((entry) => entry.id === guest.player.id)?.isHost, true);
    assert.equal(roster.filter((entry) => entry.isHost).length, 1);

    await cleanupRoom(host.room.id);
  });

  await test('B: 3+ connected players pick the oldest eligible CONNECTED non-spectator', async () => {
    const host = await mustCreate(uniqueName('محمد'));
    const first = await mustJoin(host.room.code, uniqueName('أحمد'));
    const second = await mustJoin(host.room.code, uniqueName('خالد'));

    const { hostChanged } = await confirmDisconnectThenTransfer(host.player.id, host.room.id);
    assert.equal(hostChanged?.hostPlayerId, first.player.id);

    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, first.player.id);

    const roster = await loadActiveRoomPlayers(host.room.id, room!.hostPlayerId);
    assert.equal(roster.filter((entry) => entry.isHost).length, 1);
    assert.equal(roster.find((entry) => entry.id === second.player.id)?.isHost, false);
    assert.equal(roster.find((entry) => entry.id === host.player.id)?.isHost, false);

    await cleanupRoom(host.room.id);
  });

  await test('C: rebound before disconnect finalizes does not transfer host', async () => {
    const host = await mustCreate(uniqueName('محمد'));
    const guest = await mustJoin(host.room.code, uniqueName('أحمد'));

    const { presence, hostChanged } = await confirmDisconnectThenTransfer(
      host.player.id,
      host.room.id,
      mockIo([
        [],
        [
          {
            id: 'new-socket',
            data: { playerId: host.player.id, roomId: host.room.id },
          },
        ],
      ]),
    );
    assert.equal(presence, 'restored');
    assert.equal(hostChanged, null);

    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, host.player.id);
    const hostRow = await prisma.player.findUnique({ where: { id: host.player.id } });
    assert.equal(hostRow?.status, PlayerStatus.CONNECTED);
    const guestRow = await prisma.player.findUnique({ where: { id: guest.player.id } });
    assert.equal(guestRow?.status, PlayerStatus.CONNECTED);

    await cleanupRoom(host.room.id);
  });

  await test('C2: reconnect after DISCONNECTED write but before transfer keeps host', async () => {
    const host = await mustCreate(uniqueName('محمد'));
    const guest = await mustJoin(host.room.code, uniqueName('أحمد'));

    const presence = await applySocketDisconnectPresence(
      mockIo([[]]),
      host.player.id,
      host.room.id,
      'old-socket',
    );
    assert.equal(presence, 'disconnected');

    const recon = await reconnectPlayer({
      playerId: host.player.id,
      reconnectToken: host.reconnectToken,
      roomId: host.room.id,
      roomCode: host.room.code,
    });
    assert.equal(recon.success, true);

    const hostChanged = await transferHostIfCurrentHostDisconnected(host.room.id, host.player.id);
    assert.equal(hostChanged, null);

    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, host.player.id);
    assert.equal(guest.player.id !== room?.hostPlayerId, true);

    await cleanupRoom(host.room.id);
  });

  await test('D: reconnect after transfer restores the same player without taking host back', async () => {
    const host = await mustCreate(uniqueName('محمد'));
    const guest = await mustJoin(host.room.code, uniqueName('أحمد'));
    await confirmDisconnectThenTransfer(host.player.id, host.room.id);

    const recon = await reconnectPlayer({
      playerId: host.player.id,
      reconnectToken: host.reconnectToken,
      roomId: host.room.id,
      roomCode: host.room.code,
    });
    assert.equal(recon.success, true);
    if (!recon.success) {
      throw new Error(recon.error.message);
    }

    assert.equal(recon.data.player.id, host.player.id);
    assert.equal(recon.data.player.status, 'CONNECTED');
    assert.equal(recon.data.player.isHost, false);
    assert.equal(recon.data.room.hostPlayerId, guest.player.id);
    assert.equal(recon.data.players.filter((entry) => entry.id === host.player.id).length, 1);
    assert.equal(recon.data.players.find((entry) => entry.isHost)?.id, guest.player.id);

    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, guest.player.id);

    await cleanupRoom(host.room.id);
  });

  await test('E: host transfer during an active match does not alter match shell state', async () => {
    const host = await mustCreate(uniqueName('محمد'));
    const guest = await mustJoin(host.room.code, uniqueName('أحمد'));
    const shell = playingShell({
      roomId: host.room.id,
      hostId: host.player.id,
      hostName: host.player.name,
      guestId: guest.player.id,
      guestName: guest.player.name,
    });
    replaceGameShellForTests(shell);
    const before = structuredClone(getGameShellByRoomId(host.room.id));

    const { hostChanged } = await confirmDisconnectThenTransfer(host.player.id, host.room.id);
    assert.equal(hostChanged?.hostPlayerId, guest.player.id);

    const after = getGameShellByRoomId(host.room.id);
    assert.deepEqual(after, before);
    assert.equal(after?.phase, 'PLAYING');
    assert.deepEqual(after?.matchParticipantIds, [host.player.id, guest.player.id]);
    assert.equal(after?.gameTimerRemainingSeconds, 42);
    assert.equal(after?.hostPlayerId, host.player.id);

    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, guest.player.id);

    await cleanupRoom(host.room.id);
  });

  await test('F: no eligible connected player keeps the disconnected host', async () => {
    const alone = await mustCreate(uniqueName('محمد'));
    const aloneResult = await confirmDisconnectThenTransfer(alone.player.id, alone.room.id);
    assert.equal(aloneResult.presence, 'disconnected');
    assert.equal(aloneResult.hostChanged, null);
    assert.equal(
      (await prisma.room.findUnique({ where: { id: alone.room.id } }))?.hostPlayerId,
      alone.player.id,
    );
    await cleanupRoom(alone.room.id);

    const hosted = await mustCreate(uniqueName('محمد'));
    const other = await mustJoin(hosted.room.code, uniqueName('أحمد'));
    await handlePlayerDisconnect(other.player.id, other.room.id);
    const noConnected = await confirmDisconnectThenTransfer(hosted.player.id, hosted.room.id);
    assert.equal(noConnected.hostChanged, null);
    assert.equal(
      (await prisma.room.findUnique({ where: { id: hosted.room.id } }))?.hostPlayerId,
      hosted.player.id,
    );
    await cleanupRoom(hosted.room.id);

    const withSpectator = await mustCreate(uniqueName('محمد'));
    const spectator = await mustJoin(withSpectator.room.code, uniqueName('متفرج'));
    await prisma.player.update({
      where: { id: spectator.player.id },
      data: { isSpectator: true },
    });
    const spectatorResult = await confirmDisconnectThenTransfer(
      withSpectator.player.id,
      withSpectator.room.id,
    );
    assert.equal(spectatorResult.hostChanged, null);
    assert.equal(
      (await prisma.room.findUnique({ where: { id: withSpectator.room.id } }))?.hostPlayerId,
      withSpectator.player.id,
    );
    await cleanupRoom(withSpectator.room.id);
  });

  await test('G: explicit host leave still transfers using the existing departure path', async () => {
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
    await cleanupRoom(hosted.room.id);
  });

  await test('duplicate confirmed disconnect transfers do not create two hosts', async () => {
    const host = await mustCreate(uniqueName('محمد'));
    const guest = await mustJoin(host.room.code, uniqueName('أحمد'));
    await handlePlayerDisconnect(host.player.id, host.room.id);

    const [first, second] = await Promise.all([
      transferHostIfCurrentHostDisconnected(host.room.id, host.player.id),
      transferHostIfCurrentHostDisconnected(host.room.id, host.player.id),
    ]);
    const transferred = [first, second].filter((payload) => payload !== null);
    assert.equal(transferred.length, 1);
    assert.equal(transferred[0]?.hostPlayerId, guest.player.id);

    const room = await prisma.room.findUnique({ where: { id: host.room.id } });
    assert.equal(room?.hostPlayerId, guest.player.id);

    const history = await prisma.roomHistory.findUnique({
      where: { liveRoomId: host.room.id },
      include: { hostChanges: { orderBy: { assignedAt: 'asc' } } },
    });
    assert.equal(history?.currentHostPlayerId, guest.player.id);
    assert.deepEqual(
      history?.hostChanges.map((change) => change.livePlayerId),
      [host.player.id, guest.player.id],
    );

    const hostParticipation = await prisma.roomParticipationHistory.findFirst({
      where: { livePlayerId: host.player.id, leftAt: null },
    });
    assert.ok(hostParticipation);

    await cleanupRoom(host.room.id);
  });

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
