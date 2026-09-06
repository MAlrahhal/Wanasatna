/**
 * Join → Start races: concurrent shell init, join vs start, disconnect, host transfer.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/join-start-race.unit.test.ts
 */
import assert from 'node:assert/strict';
import { PlayerStatus } from '@prisma/client';
import '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import {
  deleteGameShell,
  getGameShellByRoomId,
  initGameShell,
  startGameShellCountdown,
  syncGameShell,
} from '../src/modules/game/game.service.js';
import { transferHost } from '../src/modules/room/services/host.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';
import { reconnectPlayer } from '../src/modules/room/services/reconnect.service.js';

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

function assertJoinerLockConsistent(isSpectator: boolean, inLock: boolean): void {
  if (isSpectator) {
    assert.equal(inLock, false, 'late join / spectator must not be locked into the match');
    return;
  }

  assert.equal(inLock, true, 'lobby participant must be in matchParticipantIds after countdown');
}

async function main(): Promise<void> {
  await test('concurrent duplicate start keeps one shell and rejects the other', async () => {
    const host = await mustCreate(uniqueName('مضيف'));

    try {
      const [first, second] = await Promise.all([
        initGameShell(host.room.id, host.player.id, { gameId: 'bara-al-salafa' }),
        initGameShell(host.room.id, host.player.id, { gameId: 'draw-guess' }),
      ]);

      const outcomes = [first, second];
      const successes = outcomes.filter((result) => result.success);
      const rejected = outcomes.filter(
        (result) => !result.success && result.error.code === 'SHELL_ALREADY_EXISTS',
      );

      assert.equal(successes.length, 1, 'exactly one start must install the shell');
      assert.equal(rejected.length, 1, 'the other start must be SHELL_ALREADY_EXISTS');

      const winner = successes[0]!;
      assert.equal(winner.success, true);
      const shell = getGameShellByRoomId(host.room.id);
      assert.ok(shell);
      assert.equal(shell.shellId, winner.data.state.shellId);
      assert.equal(shell.gameId, winner.data.state.gameId);
      assert.equal(shell.phase, 'WAITING');
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('join immediately before start includes the player in the lock', async () => {
    const host = await mustCreate(uniqueName('مضيف'));

    try {
      const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
      const init = await initGameShell(host.room.id, host.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(init.success, true, init.success ? '' : init.error.message);
      assert.equal(guest.player.isSpectator, false);

      const started = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(started.success, true, started.success ? '' : started.error.message);

      const shell = getGameShellByRoomId(host.room.id);
      assert.ok(shell?.matchParticipantIds);
      assert.equal(shell.matchParticipantIds.includes(host.player.id), true);
      assert.equal(shell.matchParticipantIds.includes(guest.player.id), true);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('join concurrent with start+countdown never splits spectator flag from the lock', async () => {
    const host = await mustCreate(uniqueName('مضيف'));

    try {
      const [joinResult, startResult] = await Promise.all([
        joinRoom({ roomCode: host.room.code, playerName: uniqueName('ضيف') }),
        (async () => {
          const init = await initGameShell(host.room.id, host.player.id, {
            gameId: 'bara-al-salafa',
          });
          if (!init.success) {
            return init;
          }
          return startGameShellCountdown(host.room.id, host.player.id);
        })(),
      ]);

      assert.equal(joinResult.success, true, joinResult.success ? '' : joinResult.error.message);
      assert.equal(startResult.success, true, startResult.success ? '' : startResult.error.message);
      if (!joinResult.success || !startResult.success) {
        return;
      }

      const shell = getGameShellByRoomId(host.room.id);
      assert.ok(shell?.matchParticipantIds);
      assertJoinerLockConsistent(
        joinResult.data.player.isSpectator,
        shell.matchParticipantIds.includes(joinResult.data.player.id),
      );
      assert.equal(shell.matchParticipantIds.includes(host.player.id), true);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('late join after shell exists is spectator and excluded from the lock', async () => {
    const host = await mustCreate(uniqueName('مضيف'));

    try {
      const init = await initGameShell(host.room.id, host.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(init.success, true, init.success ? '' : init.error.message);

      const waiter = await mustJoin(host.room.code, uniqueName('متفرج'));
      assert.equal(waiter.player.isSpectator, true);

      const started = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(started.success, true, started.success ? '' : started.error.message);

      const shell = getGameShellByRoomId(host.room.id);
      assert.ok(shell?.matchParticipantIds);
      assert.equal(shell.matchParticipantIds.includes(waiter.player.id), false);
      assert.equal(shell.matchParticipantIds.includes(host.player.id), true);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('disconnected lobby player is not locked as an active participant', async () => {
    const host = await mustCreate(uniqueName('مضيف'));

    try {
      const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
      await prisma.player.update({
        where: { id: guest.player.id },
        data: { status: PlayerStatus.DISCONNECTED },
      });

      const init = await initGameShell(host.room.id, host.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(init.success, true, init.success ? '' : init.error.message);

      const started = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(started.success, true, started.success ? '' : started.error.message);

      const shell = getGameShellByRoomId(host.room.id);
      assert.ok(shell?.matchParticipantIds);
      assert.equal(shell.matchParticipantIds.includes(host.player.id), true);
      assert.equal(shell.matchParticipantIds.includes(guest.player.id), false);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('reconnect during WAITING receives the shell and stays in the lock', async () => {
    const host = await mustCreate(uniqueName('مضيف'));

    try {
      const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
      const init = await initGameShell(host.room.id, host.player.id, {
        gameId: 'bara-al-salafa',
      });
      assert.equal(init.success, true, init.success ? '' : init.error.message);

      const recon = await reconnectPlayer({
        playerId: guest.player.id,
        reconnectToken: guest.reconnectToken,
        roomCode: host.room.code,
      });
      assert.equal(recon.success, true, recon.success ? '' : recon.error.message);

      const synced = await syncGameShell(host.room.id);
      assert.equal(synced.success, true);
      assert.equal(synced.success ? synced.data.state?.phase : null, 'WAITING');
      assert.equal(synced.success ? synced.data.state?.gameId : null, 'bara-al-salafa');

      const started = await startGameShellCountdown(host.room.id, host.player.id);
      assert.equal(started.success, true, started.success ? '' : started.error.message);

      const shell = getGameShellByRoomId(host.room.id);
      assert.ok(shell?.matchParticipantIds);
      assert.equal(shell.matchParticipantIds.includes(guest.player.id), true);
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('host transfer concurrent with start does not install two shells', async () => {
    const host = await mustCreate(uniqueName('مضيف'));

    try {
      const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
      const [startResult, hostChanged] = await Promise.all([
        initGameShell(host.room.id, host.player.id, { gameId: 'bara-al-salafa' }),
        transferHost(host.room.id, host.player.id),
      ]);

      const shell = getGameShellByRoomId(host.room.id);
      const room = await prisma.room.findUnique({
        where: { id: host.room.id },
        select: { hostPlayerId: true },
      });
      assert.ok(room);

      if (startResult.success) {
        assert.ok(shell);
        assert.equal(shell.shellId, startResult.data.state.shellId);
        const second = await initGameShell(host.room.id, room.hostPlayerId, {
          gameId: 'draw-guess',
        });
        assert.equal(second.success, false);
        assert.equal(second.success ? '' : second.error.code, 'SHELL_ALREADY_EXISTS');
        assert.equal(getGameShellByRoomId(host.room.id)?.gameId, 'bara-al-salafa');
      } else {
        assert.equal(startResult.error.code, 'NOT_HOST');
        assert.equal(shell, null);
        assert.equal(hostChanged?.hostPlayerId, guest.player.id);
        const successorStart = await initGameShell(host.room.id, guest.player.id, {
          gameId: 'draw-guess',
        });
        assert.equal(
          successorStart.success,
          true,
          successorStart.success ? '' : successorStart.error.message,
        );
      }
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
