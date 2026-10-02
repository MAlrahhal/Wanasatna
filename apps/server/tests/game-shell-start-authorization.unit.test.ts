/**
 * Lobby-start authorization ordering regression tests.
 * Uses a capture-only Prisma client and never connects to a database.
 *
 * Run: pnpm --filter @wanasatna/server exec tsx tests/game-shell-start-authorization.unit.test.ts
 */
import assert from 'node:assert/strict';

process.env.WANASATNA_TEST_MODE = '1';
process.env.TEST_DATABASE_URL =
  'postgresql://unit:unit@127.0.0.1:1/wanasatna_lobby_start_authorization_unit';
delete process.env.DATABASE_URL;
delete process.env.PRODUCTION_DATABASE_URL;

type AckResponse = {
  success: boolean;
  error?: { code: string; message: string };
};

type SocketHandler = (
  payload: unknown,
  callback: (response: AckResponse) => void,
) => void | Promise<void>;

function createFakeSocket(playerId: string, roomId: string) {
  const handlers = new Map<string, SocketHandler>();
  return {
    data: { playerId, roomId },
    on(event: string, handler: SocketHandler) {
      handlers.set(event, handler);
    },
    handlers,
  };
}

function emitAck(
  socket: ReturnType<typeof createFakeSocket>,
  event: string,
  payload: unknown,
): Promise<AckResponse> {
  return new Promise((resolve, reject) => {
    const handler = socket.handlers.get(event);
    if (!handler) {
      reject(new Error(`Missing handler ${event}.`));
      return;
    }

    void handler(payload, resolve);
  });
}

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

async function main(): Promise<void> {
  const {
    BARA_AL_SALAFA_GAME_ID,
    DRAW_GUESS_GAME_ID,
    GAME_SHELL_START_FROM_LOBBY_EVENT,
    GUESSING_CHALLENGE_GAME_ID,
    TIMING_CHALLENGE_GAME_ID,
  } = await import('@wanasatna/shared');
  const { prisma } = await import('../src/lib/prisma.js');
  const { registerAllGameContent } = await import('../src/modules/content/index.js');
  const { registerGameShellStartFromLobbyHandler } =
    await import('../src/modules/game/game.socket.handlers.js');
  const { deleteGameShell } = await import('../src/modules/game/game.service.js');
  const { clearLobbyWaitTimeout } = await import('../src/modules/game/game.lifecycle.js');
  const { stopGameShellTimer } = await import('../src/modules/game/game.timer.js');
  const { registerAllGamePlugins } = await import('../src/modules/game/plugins/index.js');
  const {
    clearDrawGuessRoomDrawerSettings,
    getDrawGuessRoomDrawerSettings,
    setDrawGuessRoomDrawerSettings,
  } = await import('../src/modules/game/plugins/draw-guess/drawer-mode-store.js');
  const {
    clearGuessingChallengeRoomMode,
    getGuessingChallengeRoomMode,
    setGuessingChallengeRoomMode,
  } = await import('../src/modules/game/plugins/guessing-challenge/mode-store.js');
  const { clearTimingChallengeSettings, getTimingChallengeSettings, setTimingChallengeSettings } =
    await import('../src/modules/game/plugins/timing-challenge/store.js');
  const { clearPregameTeams, getPregameTeams } =
    await import('../src/modules/game/runtime/pregame-teams-store.js');
  const { configurePregameTeams } =
    await import('../src/modules/game/runtime/pregame-teams.service.js');
  const { clearRoomRoundCategory, getRoomRoundCategory, setRoomRoundCategory } =
    await import('../src/modules/game/runtime/round-category-store.js');
  const { clearRoomGameSettingsCache, getRoomGameSettings, setRoomGameSettingsCache } =
    await import('../src/modules/room/room-game-settings.store.js');
  const { clearMarathonState } = await import('../src/modules/marathon/marathon.runtime.js');
  const { getMarathonState, setMarathonState } =
    await import('../src/modules/marathon/marathon.store.js');

  registerAllGameContent();
  registerAllGamePlugins();

  const roomId = 'room-lobby-start-auth';
  const hostPlayerId = 'host-player';
  const guestPlayerId = 'guest-player';
  const players = [
    {
      id: hostPlayerId,
      name: 'Host',
      status: 'CONNECTED',
      isSpectator: false,
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: guestPlayerId,
      name: 'Guest',
      status: 'CONNECTED',
      isSpectator: false,
      joinedAt: new Date('2026-01-01T00:00:01.000Z'),
    },
  ];

  const prismaClient = prisma as unknown as {
    room: { findUnique: (args: unknown) => Promise<unknown> };
    player: { findMany: (args: unknown) => Promise<unknown[]> };
    gameAdminConfig: { findMany: (args: unknown) => Promise<unknown[]> };
    $transaction: (
      callback: (transaction: {
        $queryRaw: (...args: unknown[]) => Promise<Array<{ id: string }>>;
        room: { findUnique: (args: unknown) => Promise<unknown> };
        player: { findMany: (args: unknown) => Promise<unknown[]> };
      }) => Promise<unknown>,
    ) => Promise<unknown>;
  };
  const originals = {
    roomFindUnique: prismaClient.room.findUnique,
    playerFindMany: prismaClient.player.findMany,
    gameConfigFindMany: prismaClient.gameAdminConfig.findMany,
    transaction: prismaClient.$transaction,
  };
  const transactionClient = {
    $queryRaw: async () => [{ id: roomId }],
    room: {
      findUnique: async () => ({ hostPlayerId }),
    },
    player: {
      findMany: async () => players,
    },
  };

  prismaClient.room.findUnique = async () => ({ hostPlayerId, gameSettings: null });
  prismaClient.player.findMany = async () => players;
  prismaClient.gameAdminConfig.findMany = async () => [];
  prismaClient.$transaction = async (callback) => callback(transactionClient);

  const emitted: Array<{ event: string; payload: unknown }> = [];
  const fakeIo = {
    to() {
      return {
        emit(event: string, payload: unknown) {
          emitted.push({ event, payload });
        },
      };
    },
  };

  function cleanupRuntime(): void {
    clearLobbyWaitTimeout(roomId);
    stopGameShellTimer(roomId);
    deleteGameShell(roomId);
    clearRoomRoundCategory(roomId);
    clearTimingChallengeSettings(roomId);
    clearGuessingChallengeRoomMode(roomId);
    clearDrawGuessRoomDrawerSettings(roomId);
    clearPregameTeams(roomId);
    clearRoomGameSettingsCache(roomId);
    clearMarathonState(roomId);
  }

  try {
    await test('bound non-host requests are rejected before every lobby-start side effect', async () => {
      cleanupRuntime();
      emitted.length = 0;

      setRoomRoundCategory(roomId, 'animals');
      setTimingChallengeSettings(roomId, {
        mode: 'guess-time',
        minSeconds: 3,
        maxSeconds: 9,
      });
      setGuessingChallengeRoomMode(roomId, '1v1');
      setDrawGuessRoomDrawerSettings(roomId, {
        drawerMode: 'random',
        fixedPlayerId: null,
      });
      configurePregameTeams({
        roomId,
        gameId: GUESSING_CHALLENGE_GAME_ID,
        mode: '1v1',
        eligiblePlayerIds: [hostPlayerId, guestPlayerId],
        preserveManual: false,
      });
      const cachedRoomSettings = {
        [TIMING_CHALLENGE_GAME_ID]: { minSeconds: 2, maxSeconds: 10 },
      };
      setRoomGameSettingsCache(roomId, cachedRoomSettings);
      const marathonState = {
        marathonId: 'marathon-1',
        roomId,
        revision: 0,
        status: 'PREPARING',
        gamePlan: [],
        currentGameIndex: 0,
        activeShellId: null,
        participantIds: [hostPlayerId, guestPlayerId],
        playerNames: { [hostPlayerId]: 'Host', [guestPlayerId]: 'Guest' },
        playerTotals: { [hostPlayerId]: 0, [guestPlayerId]: 0 },
        departedPlayerIds: [],
        completedGames: [],
        skippedGames: [],
        lastTransition: null,
        finishReason: null,
        transitionDeadlineAtMs: null,
        startedAt: null,
        finishedAt: null,
        timerGeneration: 0,
        leaderboard: [],
      } as Parameters<typeof setMarathonState>[0];
      setMarathonState(marathonState);

      const originalTeams = structuredClone(getPregameTeams(roomId));
      const guestSocket = createFakeSocket(guestPlayerId, roomId);
      registerGameShellStartFromLobbyHandler(fakeIo as never, guestSocket as never);

      const attempts = [
        {
          gameId: TIMING_CHALLENGE_GAME_ID,
          categoryId: 'food',
          timingChallenge: { mode: 'stop-timer', minSeconds: 5, maxSeconds: 12 },
        },
        {
          gameId: GUESSING_CHALLENGE_GAME_ID,
          categoryId: 'food',
          guessingChallenge: { mode: '2v2' },
        },
        {
          gameId: DRAW_GUESS_GAME_ID,
          categoryId: 'food',
          drawGuess: { drawerMode: 'fixed', fixedPlayerId: guestPlayerId },
        },
        { gameId: BARA_AL_SALAFA_GAME_ID, categoryId: 'food' },
      ];

      for (const payload of attempts) {
        const response = await emitAck(guestSocket, GAME_SHELL_START_FROM_LOBBY_EVENT, payload);
        assert.equal(response.success, false);
        assert.equal(response.error?.code, 'NOT_HOST');
        assert.equal(getRoomRoundCategory(roomId), 'animals');
        assert.deepEqual(getTimingChallengeSettings(roomId), {
          mode: 'guess-time',
          minSeconds: 3,
          maxSeconds: 9,
        });
        assert.equal(getGuessingChallengeRoomMode(roomId), '1v1');
        assert.deepEqual(getDrawGuessRoomDrawerSettings(roomId), {
          drawerMode: 'random',
          fixedPlayerId: null,
        });
        assert.deepEqual(getPregameTeams(roomId), originalTeams);
        assert.equal(getRoomGameSettings(roomId), cachedRoomSettings);
        assert.equal(getMarathonState(roomId), marathonState);
      }

      assert.equal(emitted.length, 0);
    });

    await test('host lobby starts preserve valid timing, guessing, and drawing settings', async () => {
      cleanupRuntime();
      emitted.length = 0;

      const hostSocket = createFakeSocket(hostPlayerId, roomId);
      registerGameShellStartFromLobbyHandler(fakeIo as never, hostSocket as never);

      configurePregameTeams({
        roomId,
        gameId: GUESSING_CHALLENGE_GAME_ID,
        mode: '1v1',
        eligiblePlayerIds: [hostPlayerId, guestPlayerId],
        preserveManual: false,
      });
      const guessingResponse = await emitAck(hostSocket, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: GUESSING_CHALLENGE_GAME_ID,
        categoryId: 'animals',
        guessingChallenge: { mode: '1v1' },
      });
      assert.equal(
        guessingResponse.success,
        true,
        guessingResponse.error?.message ?? 'Guessing Challenge should start.',
      );
      assert.equal(getRoomRoundCategory(roomId), 'animals');
      assert.equal(getGuessingChallengeRoomMode(roomId), '1v1');
      clearLobbyWaitTimeout(roomId);
      stopGameShellTimer(roomId);
      deleteGameShell(roomId);

      const timingResponse = await emitAck(hostSocket, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: TIMING_CHALLENGE_GAME_ID,
        categoryId: 'food',
        timingChallenge: { mode: 'stop-timer', minSeconds: 5, maxSeconds: 12 },
      });
      assert.equal(
        timingResponse.success,
        true,
        timingResponse.error?.message ?? 'Timing Challenge should start.',
      );
      assert.equal(getRoomRoundCategory(roomId), 'food');
      assert.deepEqual(getTimingChallengeSettings(roomId), {
        mode: 'stop-timer',
        minSeconds: 5,
        maxSeconds: 12,
        rounds: 3,
      });
      assert.equal(getPregameTeams(roomId), null);
      clearLobbyWaitTimeout(roomId);
      stopGameShellTimer(roomId);
      deleteGameShell(roomId);

      const drawResponse = await emitAck(hostSocket, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: DRAW_GUESS_GAME_ID,
        categoryId: 'random',
        drawGuess: { drawerMode: 'fixed', fixedPlayerId: guestPlayerId },
      });
      assert.equal(
        drawResponse.success,
        true,
        drawResponse.error?.message ?? 'Draw & Guess should start.',
      );
      assert.equal(getRoomRoundCategory(roomId), null);
      assert.deepEqual(getDrawGuessRoomDrawerSettings(roomId), {
        drawerMode: 'fixed',
        fixedPlayerId: guestPlayerId,
      });
      clearLobbyWaitTimeout(roomId);
      stopGameShellTimer(roomId);
      deleteGameShell(roomId);

      const drawDefaultResponse = await emitAck(hostSocket, GAME_SHELL_START_FROM_LOBBY_EVENT, {
        gameId: DRAW_GUESS_GAME_ID,
      });
      assert.equal(
        drawDefaultResponse.success,
        true,
        drawDefaultResponse.error?.message ?? 'Draw & Guess defaults should start.',
      );
      assert.deepEqual(getDrawGuessRoomDrawerSettings(roomId), {
        drawerMode: 'random',
        fixedPlayerId: null,
      });
    });
  } finally {
    cleanupRuntime();
    prismaClient.room.findUnique = originals.roomFindUnique;
    prismaClient.player.findMany = originals.playerFindMany;
    prismaClient.gameAdminConfig.findMany = originals.gameConfigFindMany;
    prismaClient.$transaction = originals.transaction;
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

void main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
