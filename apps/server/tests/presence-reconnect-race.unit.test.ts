/**
 * Disconnect/reconnect presence: DISCONNECTED is not LEFT, and a late disconnect
 * must not win over a rebound socket.
 *
 * Run: pnpm --filter @wanasatna/server test:presence-reconnect
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlayerStatus } from '@prisma/client';
import type { Server } from 'socket.io';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { loadActiveRoomPlayers } from '../src/modules/room/room.utils.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { handlePlayerDisconnect } from '../src/modules/room/services/leave-room.service.js';
import {
  applySocketDisconnectPresence,
  restoreConnectedIfDisconnected,
} from '../src/modules/room/services/presence-disconnect.service.js';
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

async function main(): Promise<void> {
  await test('source: disconnect handler uses rebound-safe presence helper', () => {
    const handlers = read('src/modules/room/room.socket.handlers.ts');
    assert.match(handlers, /applySocketDisconnectPresence/);
    assert.match(handlers, /disconnect-restored-after-rebind/);
    assert.match(handlers, /GAME_SHELL_STATE_EVENT/);

    const reconnect = read('src/modules/room/services/reconnect.service.ts');
    assert.doesNotMatch(reconnect, /createDurableRoomHistory/);
    assert.doesNotMatch(reconnect, /ROOM_JOINED/);

    const gameService = read('src/modules/game/game.service.ts');
    assert.match(
      gameService,
      /filter\(\(player\) => player\.isConnected && !player\.isSpectator\)/,
    );
  });

  await test('refresh disconnect does not LEFT and keeps the same seat in the roster', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));

    const outcome = await applySocketDisconnectPresence(
      mockIo([[]]),
      guest.player.id,
      guest.room.id,
      'old-socket',
    );
    assert.equal(outcome, 'disconnected');

    const player = await prisma.player.findUnique({ where: { id: guest.player.id } });
    assert.equal(player?.status, PlayerStatus.DISCONNECTED);

    const roster = await loadActiveRoomPlayers(guest.room.id, host.player.id);
    assert.equal(roster.length, 2);
    assert.equal(roster.filter((entry) => entry.id === guest.player.id).length, 1);
    assert.equal(roster.find((entry) => entry.id === guest.player.id)?.status, 'DISCONNECTED');

    const participations = await prisma.roomParticipationHistory.findMany({
      where: { livePlayerId: guest.player.id },
    });
    assert.equal(participations.length, 1);
    assert.equal(participations[0]?.leftAt, null);

    await cleanupRoom(host.room.id);
  });

  await test('reconnect restores the same playerId without a duplicate seat or history row', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    await handlePlayerDisconnect(guest.player.id, guest.room.id);

    const recon = await reconnectPlayer({
      playerId: guest.player.id,
      reconnectToken: guest.reconnectToken,
      roomId: guest.room.id,
      roomCode: guest.room.code,
    });
    assert.equal(recon.success, true);
    if (!recon.success) {
      throw new Error(recon.error.message);
    }

    assert.equal(recon.data.player.id, guest.player.id);
    assert.equal(recon.data.player.status, 'CONNECTED');
    assert.equal(recon.data.players.filter((entry) => entry.id === guest.player.id).length, 1);

    const players = await prisma.player.findMany({ where: { roomId: guest.room.id } });
    assert.equal(players.filter((entry) => entry.name === guest.player.name).length, 1);

    const participations = await prisma.roomParticipationHistory.findMany({
      where: { livePlayerId: guest.player.id },
    });
    assert.equal(participations.length, 1);
    assert.equal(participations[0]?.leftAt, null);

    await cleanupRoom(host.room.id);
  });

  await test('already-bound socket skips disconnect entirely', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));

    const outcome = await applySocketDisconnectPresence(
      mockIo([
        [
          {
            id: 'new-socket',
            data: { playerId: guest.player.id, roomId: guest.room.id },
          },
        ],
      ]),
      guest.player.id,
      guest.room.id,
      'old-socket',
    );
    assert.equal(outcome, 'ignored');

    const player = await prisma.player.findUnique({ where: { id: guest.player.id } });
    assert.equal(player?.status, PlayerStatus.CONNECTED);

    await cleanupRoom(host.room.id);
  });

  await test('late disconnect after reconnect bind restores CONNECTED', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));

    const outcome = await applySocketDisconnectPresence(
      mockIo([
        [],
        [
          {
            id: 'new-socket',
            data: { playerId: guest.player.id, roomId: guest.room.id },
          },
        ],
      ]),
      guest.player.id,
      guest.room.id,
      'old-socket',
    );
    assert.equal(outcome, 'restored');

    const player = await prisma.player.findUnique({ where: { id: guest.player.id } });
    assert.equal(player?.status, PlayerStatus.CONNECTED);

    const roster = await loadActiveRoomPlayers(guest.room.id, host.player.id);
    assert.equal(roster.find((entry) => entry.id === guest.player.id)?.status, 'CONNECTED');

    await cleanupRoom(host.room.id);
  });

  await test('restoreConnectedIfDisconnected never revives LEFT', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    await prisma.player.update({
      where: { id: guest.player.id },
      data: { status: PlayerStatus.LEFT },
    });

    const restored = await restoreConnectedIfDisconnected(guest.player.id, guest.room.id);
    assert.equal(restored, false);
    const player = await prisma.player.findUnique({ where: { id: guest.player.id } });
    assert.equal(player?.status, PlayerStatus.LEFT);

    await cleanupRoom(host.room.id);
  });

  await test('naive handlePlayerDisconnect after reconnect can still mark DISCONNECTED', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    await handlePlayerDisconnect(guest.player.id, guest.room.id);
    const recon = await reconnectPlayer({
      playerId: guest.player.id,
      reconnectToken: guest.reconnectToken,
      roomId: guest.room.id,
      roomCode: guest.room.code,
    });
    assert.equal(recon.success, true);

    await handlePlayerDisconnect(guest.player.id, guest.room.id);
    const player = await prisma.player.findUnique({ where: { id: guest.player.id } });
    assert.equal(player?.status, PlayerStatus.DISCONNECTED);

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
