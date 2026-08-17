/**
 * Spectator Mode — join, lock, history, reconnect, lobby reset.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/spectator-mode.unit.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchStatus, PlayerStatus } from '@prisma/client';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  deleteGameShell,
  getGameShellByRoomId,
  initGameShell,
  startGameShellCountdown,
} from '../src/modules/game/game.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';
import { clearRoomSpectatorFlags } from '../src/modules/room/services/clear-spectators.service.js';

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

async function cleanupRoom(roomId: string): Promise<void> {
  deleteGameShell(roomId);
  await prisma.match.deleteMany({ where: { roomId } }).catch(() => undefined);
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
}

async function main(): Promise<void> {
  await test('source: no schema/migration/dependency/chat/admin change', () => {
    const schema = read('prisma/schema.prisma');
    assert.match(schema, /isSpectator\s+Boolean\s+@default\(false\)/);

    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
    assert.deepEqual(Object.keys(pkg.dependencies ?? {}).sort(), [
      '@prisma/client',
      '@wanasatna/shared',
      'argon2',
      'cors',
      'dotenv',
      'express',
      'prisma',
      'socket.io',
      'zod',
    ]);

    const join = read('src/modules/room/services/join-room.service.ts');
    assert.match(join, /getGameShellByRoomId\(roomId\) !== null/);

    const shell = read('src/modules/game/game.service.ts');
    assert.match(shell, /!player\.isSpectator/);

    const lifecycle = read('src/modules/game/game.lifecycle.ts');
    assert.match(lifecycle, /clearRoomSpectatorFlags/);
    assert.match(lifecycle, /teardownShellAndReturnToLobby/);

    const chatRoute = read('src/modules/room/room.socket.handlers.ts');
    assert.doesNotMatch(chatRoute, /registerChat|CHAT_MESSAGE|send-chat/);
    assert.doesNotMatch(read('src/index.ts'), /admin/i);

    for (const plugin of [
      'bara-al-salafa',
      'draw-guess',
      'imposter-draw',
      'timing-challenge',
      'fast-answer',
      'who-wrote-it',
      'judge',
      'guessing-challenge',
    ]) {
      assert.match(
        read(`src/modules/game/plugins/${plugin}/socket.handlers.ts`),
        /NOT_PARTICIPANT/,
        `${plugin} must reject spectator gameplay actions`,
      );
    }
  });

  await test('mid-match join sets isSpectator and is excluded from lock + history', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    let spectatorId: string | undefined;

    try {
      const init = await initGameShell(host.room.id, host.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(init.success, true, init.success ? '' : init.error.message);

      const spectator = await mustJoin(host.room.code, uniqueName('متفرج'));
      spectatorId = spectator.player.id;
      assert.equal(spectator.player.isSpectator, true);

      const started = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(started.success, true, started.success ? '' : started.error.message);

      const shell = getGameShellByRoomId(host.room.id);
      assert.ok(shell?.matchParticipantIds);
      assert.equal(shell.matchParticipantIds.includes(host.player.id), true);
      assert.equal(shell.matchParticipantIds.includes(guest.player.id), true);
      assert.equal(shell.matchParticipantIds.includes(spectator.player.id), false);

      const match = await prisma.match.findFirst({
        where: { roomId: host.room.id, status: MatchStatus.ACTIVE },
        include: { participants: true },
      });
      assert.ok(match);
      assert.equal(match.participants.length, 2);
      assert.ok(!match.participants.some((row) => row.playerId === spectator.player.id));
    } finally {
      await cleanupRoom(host.room.id);
      if (spectatorId) {
        await prisma.player.deleteMany({ where: { id: spectatorId } }).catch(() => undefined);
      }
    }
  });

  await test('lobby join is not spectator; reconnect keeps spectator/participant', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));

    try {
      assert.equal(host.player.isSpectator, false);
      assert.equal(guest.player.isSpectator, false);

      const init = await initGameShell(host.room.id, host.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(init.success, true, init.success ? '' : init.error.message);

      const spectator = await mustJoin(host.room.code, uniqueName('متفرج'));
      assert.equal(spectator.player.isSpectator, true);
      assert.ok(spectator.reconnectToken);

      const specReconnect = await reconnectPlayer({
        playerId: spectator.player.id,
        reconnectToken: spectator.reconnectToken,
        roomCode: host.room.code,
      });
      assert.equal(specReconnect.success, true);
      if (specReconnect.success) {
        assert.equal(specReconnect.data.player.isSpectator, true);
      }

      const hostReconnect = await reconnectPlayer({
        playerId: host.player.id,
        reconnectToken: host.reconnectToken,
        roomCode: host.room.code,
      });
      assert.equal(hostReconnect.success, true);
      if (hostReconnect.success) {
        assert.equal(hostReconnect.data.player.isSpectator, false);
      }
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('lobby reset clears spectator including disconnected seats; next lock includes them', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    await mustJoin(host.room.code, uniqueName('ضيف'));

    try {
      const init = await initGameShell(host.room.id, host.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(init.success, true, init.success ? '' : init.error.message);

      const spectator = await mustJoin(host.room.code, uniqueName('متفرج'));
      assert.equal(spectator.player.isSpectator, true);

      await prisma.player.update({
        where: { id: spectator.player.id },
        data: { status: PlayerStatus.DISCONNECTED },
      });

      await clearRoomSpectatorFlags(host.room.id);

      const cleared = await prisma.player.findUnique({
        where: { id: spectator.player.id },
        select: { isSpectator: true },
      });
      assert.equal(cleared?.isSpectator, false);

      const recon = await reconnectPlayer({
        playerId: spectator.player.id,
        reconnectToken: spectator.reconnectToken,
        roomCode: host.room.code,
      });
      assert.equal(recon.success, true);
      if (recon.success) {
        assert.equal(recon.data.player.isSpectator, false);
      }

      deleteGameShell(host.room.id);
      const initNext = await initGameShell(host.room.id, host.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(initNext.success, true, initNext.success ? '' : initNext.error.message);
      const started = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(started.success, true, started.success ? '' : started.error.message);

      const shell = getGameShellByRoomId(host.room.id);
      assert.ok(shell?.matchParticipantIds);
      assert.equal(shell.matchParticipantIds.includes(spectator.player.id), true);

      const match = await prisma.match.findFirst({
        where: { roomId: host.room.id, status: MatchStatus.ACTIVE },
        include: { participants: true },
      });
      assert.ok(match);
      assert.ok(match.participants.some((row) => row.playerId === spectator.player.id));
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
