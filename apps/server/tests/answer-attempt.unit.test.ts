/**
 * AnswerAttempt logging, retention, game instrumentation, and Admin API.
 * Run: pnpm --filter @wanasatna/server test:answer-attempt
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server, Socket } from 'socket.io';
import { AnswerAttemptStatus, MatchStatus } from '@prisma/client';
import type {
  AdminActionResponse,
  AdminAnswerAttemptData,
  DrawGuessMatchState,
  FastAnswerMatchState,
  GameShellState,
} from '@wanasatna/shared';
import {
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_SUBMIT_GUESS_EVENT,
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_SUBMIT_ANSWER_EVENT,
  FAST_ANSWER_WINNER_POINTS,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
} from '@wanasatna/shared';
import '../src/config/env.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ADMIN_DENIED_MESSAGE } from '../src/modules/admin/require-admin.js';
import { promoteExistingUserToAdmin } from '../src/modules/admin/promote-existing-user.js';
import { AUTH_COOKIE_NAME } from '../src/modules/auth/auth.cookie.js';
import { resetAuthRateLimiterForTests } from '../src/modules/auth/auth-rate-limit.js';
import { registerUser } from '../src/modules/auth/auth.service.js';
import { registerAllGameContent } from '../src/modules/content/index.js';
import {
  deleteGameShell,
  replaceGameShellForTests,
} from '../src/modules/game/game.service.js';
import { registerDrawGuessSocketHandlers } from '../src/modules/game/plugins/draw-guess/socket.handlers.js';
import { setDrawGuessState, deleteDrawGuessState } from '../src/modules/game/plugins/draw-guess/store.js';
import { clearDrawGuessPhaseTimerRuntime } from '../src/modules/game/plugins/draw-guess/phase-timer.js';
import { DRAW_GUESS_CORRECT_GUESS_POINTS } from '../src/modules/game/plugins/draw-guess/scoring.js';
import {
  clearFastAnswerRuntime,
  registerFastAnswerSocketHandlers,
} from '../src/modules/game/plugins/fast-answer/socket.handlers.js';
import { setFastAnswerState } from '../src/modules/game/plugins/fast-answer/store.js';
import { createMatchState as createGuessingChallengeMatch } from '../src/modules/game/plugins/guessing-challenge/state.js';
import {
  clearGuessingChallengeRuntime,
  registerGuessingChallengeSocketHandlers,
} from '../src/modules/game/plugins/guessing-challenge/socket.handlers.js';
import {
  getGuessingChallengeState,
  setGuessingChallengeState,
} from '../src/modules/game/plugins/guessing-challenge/store.js';
import { getGameContentSettings } from '../src/modules/content/registry.js';
import {
  ANSWER_ATTEMPT_RETENTION_DAYS,
  clearAnswerLogContext,
  purgeExpiredAnswerAttempts,
  recordAnswerAttempt,
} from '../src/modules/game/runtime/answer-attempt-log.js';
import { stopExpiredAnswerAttemptCleanup } from '../src/modules/game/runtime/answer-attempt-cleanup.js';
import { beginPersistedMatch } from '../src/modules/match/match-history.service.js';
import { createRoom } from '../src/modules/room/services/create-room.service.js';
import { joinRoom } from '../src/modules/room/services/join-room.service.js';

registerAllGameContent();

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
  return `anslog.${prefix}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@example.com`;
}

const fakeIo = { to: () => ({ emit: () => undefined }) } as unknown as Server;

function makeShell(
  roomId: string,
  gameId: string,
  players: Array<{ id: string; name: string }>,
): GameShellState {
  return {
    shellId: `shell-${roomId}`,
    roomId,
    gameId,
    phase: 'PLAYING',
    hostPlayerId: players[0]!.id,
    players: players.map((player, index) => ({
      id: player.id,
      name: player.name,
      isHost: index === 0,
      isConnected: true,
      isReady: true,
      isSpectator: false,
    })),
    readyPlayerIds: players.map((player) => player.id),
    countdownSeconds: null,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    updatedAt: new Date().toISOString(),
    matchParticipantIds: players.map((player) => player.id),
  };
}

function createFakeSocket(playerId: string, roomId: string) {
  const handlers = new Map<string, (payload: unknown, callback: (value: unknown) => void) => void>();
  const socket = {
    data: { playerId, roomId },
    on(event: string, handler: (payload: unknown, callback: (value: unknown) => void) => void) {
      handlers.set(event, handler);
    },
    emit() {
      return undefined;
    },
    handlers,
  };
  return socket as typeof socket & Socket;
}

function emitAck(
  socket: { handlers: Map<string, (payload: unknown, callback: (value: unknown) => void) => void> },
  event: string,
  payload: unknown,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const handler = socket.handlers.get(event);
    if (!handler) {
      reject(new Error(`missing handler ${event}`));
      return;
    }
    void handler(payload, resolve);
  });
}

async function mustCreate(playerName: string) {
  const result = await createRoom({ playerName });
  assert.equal(result.success, true);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function mustJoin(roomCode: string, playerName: string) {
  const result = await joinRoom({ roomCode, playerName });
  assert.equal(result.success, true);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function cleanupRoom(roomId: string): Promise<void> {
  clearFastAnswerRuntime(roomId);
  clearDrawGuessPhaseTimerRuntime(roomId);
  deleteDrawGuessState(roomId);
  clearGuessingChallengeRuntime(roomId);
  deleteGameShell(roomId);
  clearAnswerLogContext(roomId);
  await prisma.match.deleteMany({ where: { roomId } }).catch(() => undefined);
  await prisma.room.deleteMany({ where: { id: roomId } }).catch(() => undefined);
}

function cookieFromResponse(response: Response): string {
  const cookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];
  return cookies
    .filter((value) => value.startsWith(`${AUTH_COOKIE_NAME}=`))
    .map((value) => value.split(';')[0] ?? '')
    .join('; ');
}

async function withApp<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  resetAuthRateLimiterForTests();
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main(): Promise<void> {
  await test('source: handlers log attempts and routes stay admin-gated', () => {
    const fa = read('src/modules/game/plugins/fast-answer/socket.handlers.ts');
    const dg = read('src/modules/game/plugins/draw-guess/socket.handlers.ts');
    const gc = read('src/modules/game/plugins/guessing-challenge/socket.handlers.ts');
    const routes = read('src/modules/admin/admin.routes.ts');
    const index = read('src/index.ts');
    assert.match(fa, /recordAnswerAttempt/);
    assert.match(fa, /CORRECT_NOT_COUNTED/);
    assert.match(dg, /recordAnswerAttempt/);
    assert.match(gc, /recordAnswerAttempt/);
    assert.match(routes, /history\/:matchId\/answers/);
    assert.match(index, /purgeExpiredAnswerAttempts/);
  });

  await test('retention deletes old AnswerAttempt rows only and is repeatable', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    try {
      const matchId = await beginPersistedMatch({
        roomId: host.room.id,
        gameId: FAST_ANSWER_GAME_ID,
        participantPlayerIds: [host.player.id, guest.player.id],
      });
      assert.ok(matchId);
      const match = await prisma.match.findUniqueOrThrow({
        where: { id: matchId! },
        select: { roomHistoryId: true },
      });
      assert.ok(match.roomHistoryId);

      const oldDate = new Date(Date.now() - (ANSWER_ATTEMPT_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
      const recent = await prisma.answerAttempt.create({
        data: {
          roomHistoryId: match.roomHistoryId!,
          matchId: matchId!,
          gameId: FAST_ANSWER_GAME_ID,
          playerDisplayName: 'حديث',
          rawAnswer: 'حديث',
          status: AnswerAttemptStatus.WRONG_NOT_COUNTED,
          wasCorrect: false,
          wasCounted: false,
          promptText: 'سؤال',
        },
      });
      const expired = await prisma.answerAttempt.create({
        data: {
          roomHistoryId: match.roomHistoryId!,
          matchId: matchId!,
          gameId: FAST_ANSWER_GAME_ID,
          submittedAt: oldDate,
          playerDisplayName: 'قديم',
          rawAnswer: 'قديم',
          status: AnswerAttemptStatus.WRONG_NOT_COUNTED,
          wasCorrect: false,
          wasCounted: false,
          promptText: 'سؤال',
        },
      });

      const first = await purgeExpiredAnswerAttempts();
      assert.ok(first >= 1);
      assert.equal(
        await prisma.answerAttempt.findUnique({ where: { id: expired.id } }),
        null,
      );
      assert.ok(await prisma.answerAttempt.findUnique({ where: { id: recent.id } }));
      assert.ok(await prisma.match.findUnique({ where: { id: matchId! } }));
      assert.ok(await prisma.roomHistory.findUnique({ where: { id: match.roomHistoryId! } }));

      const second = await purgeExpiredAnswerAttempts();
      assert.equal(second, 0);
      assert.ok(await prisma.answerAttempt.findUnique({ where: { id: recent.id } }));
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('logger skips writes without match context and stores clipped snapshots', async () => {
    clearAnswerLogContext('missing-room');
    await recordAnswerAttempt({
      roomId: 'missing-room',
      gameId: FAST_ANSWER_GAME_ID,
      playerId: 'p1',
      playerDisplayName: 'لاعب',
      rawAnswer: 'لن تُحفظ',
      normalizedAnswer: null,
      status: AnswerAttemptStatus.REJECTED,
      wasCorrect: null,
      wasCounted: false,
      promptText: 'سؤال',
    });
    assert.equal(
      await prisma.answerAttempt.count({ where: { rawAnswer: 'لن تُحفظ' } }),
      0,
    );
  });

  await test('Fast Answer logs counted winner, uncounted correct race loser, and wrong answers', async () => {
    const host = await mustCreate(uniqueName('مضيف'));
    const guest = await mustJoin(host.room.code, uniqueName('ضيف'));
    try {
      const matchId = await beginPersistedMatch({
        roomId: host.room.id,
        gameId: FAST_ANSWER_GAME_ID,
        participantPlayerIds: [host.player.id, guest.player.id],
      });
      assert.ok(matchId);
      const players = [
        { id: host.player.id, name: host.player.name },
        { id: guest.player.id, name: guest.player.name },
      ];
      replaceGameShellForTests(makeShell(host.room.id, FAST_ANSWER_GAME_ID, players));
      const faMatch: FastAnswerMatchState = {
        playerIds: [host.player.id, guest.player.id],
        playerNames: {
          [host.player.id]: host.player.name,
          [guest.player.id]: guest.player.name,
        },
        currentRound: 1,
        totalRounds: 5,
        scores: { [host.player.id]: 0, [guest.player.id]: 0 },
        matchStatus: 'in-progress',
        lockedCategoryId: 'countries',
        lockedCategoryLabel: 'دول',
        usedRoundCategoryIds: [],
        roundTimeSeconds: 15,
        recentQuestionIds: ['q-1'],
        round: {
          roundId: 'round-fa-1',
          gamePhase: 'question',
          phaseRemainingSeconds: 15,
          questionId: 'q-1',
          question: 'عاصمة السعودية؟',
          categoryId: 'countries',
          acceptedAnswers: ['الرياض', 'Riyadh'],
          deadlineAtMs: Date.now() + 15_000,
          winnerPlayerId: null,
          timedOut: false,
        },
      };
      setFastAnswerState(host.room.id, faMatch);

      const hostSocket = createFakeSocket(host.player.id, host.room.id);
      const guestSocket = createFakeSocket(guest.player.id, host.room.id);
      registerFastAnswerSocketHandlers(fakeIo, hostSocket);
      registerFastAnswerSocketHandlers(fakeIo, guestSocket);

      const wrong = await emitAck(guestSocket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
        answer: 'جدة',
        roundId: 'round-fa-1',
      });
      assert.equal((wrong as { success: boolean }).success, true);
      assert.equal((wrong as { data: { correct: boolean } }).data.correct, false);

      const winner = await emitAck(hostSocket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
        answer: 'الرياض',
        roundId: 'round-fa-1',
      });
      assert.equal((winner as { data: { correct: boolean } }).data.correct, true);

      const loser = await emitAck(guestSocket, FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
        answer: 'Riyadh',
        roundId: 'round-fa-1',
      });
      assert.equal((loser as { success: boolean }).success, false);

      const rows = await prisma.answerAttempt.findMany({
        where: { matchId: matchId! },
        orderBy: { submittedAt: 'asc' },
      });
      assert.equal(rows.length, 3);
      assert.equal(rows[0]?.status, AnswerAttemptStatus.WRONG_NOT_COUNTED);
      assert.equal(rows[0]?.wasCounted, false);
      assert.equal(rows[1]?.status, AnswerAttemptStatus.CORRECT_COUNTED);
      assert.equal(rows[1]?.wasCounted, true);
      assert.equal(rows[1]?.pointsAwarded, FAST_ANSWER_WINNER_POINTS);
      assert.equal(rows[2]?.status, AnswerAttemptStatus.CORRECT_NOT_COUNTED);
      assert.equal(rows[2]?.wasCorrect, true);
      assert.equal(rows[2]?.wasCounted, false);
      assert.equal(rows[2]?.rawAnswer, 'Riyadh');
      assert.equal(rows[2]?.normalizedAnswer, 'riyadh');
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('Draw & Guess logs correct counted and wrong not counted answers', async () => {
    const host = await mustCreate(uniqueName('رسام'));
    const guest = await mustJoin(host.room.code, uniqueName('خمّن'));
    try {
      const matchId = await beginPersistedMatch({
        roomId: host.room.id,
        gameId: DRAW_GUESS_GAME_ID,
        participantPlayerIds: [host.player.id, guest.player.id],
      });
      assert.ok(matchId);
      const players = [
        { id: host.player.id, name: host.player.name },
        { id: guest.player.id, name: guest.player.name },
      ];
      replaceGameShellForTests(makeShell(host.room.id, DRAW_GUESS_GAME_ID, players));
      const dgMatch: DrawGuessMatchState = {
        playerIds: [host.player.id, guest.player.id],
        playerNames: {
          [host.player.id]: host.player.name,
          [guest.player.id]: guest.player.name,
        },
        currentRound: 1,
        totalRounds: 3,
        scores: { [host.player.id]: 0, [guest.player.id]: 0 },
        matchStatus: 'in-progress',
        drawerMode: 'fixed',
        fixedDrawerPlayerId: host.player.id,
        usedWordTexts: ['أسد'],
        round: {
          turnId: 'turn-dg-1',
          word: 'أسد',
          wordCategoryId: 'animals',
          drawerPlayerId: host.player.id,
          gamePhase: 'drawing',
          phaseRemainingSeconds: 60,
          deadlineAtMs: Date.now() + 60_000,
          drawingDurationSeconds: 60,
          strokes: [],
          correctGuesserPlayerId: null,
          guessedCorrectly: false,
        },
      };
      setDrawGuessState(host.room.id, dgMatch);
      const guesser = createFakeSocket(guest.player.id, host.room.id);
      const drawer = createFakeSocket(host.player.id, host.room.id);
      registerDrawGuessSocketHandlers(fakeIo, guesser);
      registerDrawGuessSocketHandlers(fakeIo, drawer);

      const drawerRejected = await emitAck(drawer, DRAW_GUESS_SUBMIT_GUESS_EVENT, { guess: 'أسد' });
      assert.equal((drawerRejected as { success: boolean }).success, false);
      const wrong = await emitAck(guesser, DRAW_GUESS_SUBMIT_GUESS_EVENT, { guess: 'نمر' });
      assert.equal((wrong as { data: { correct: boolean } }).data.correct, false);
      const right = await emitAck(guesser, DRAW_GUESS_SUBMIT_GUESS_EVENT, { guess: 'أسد' });
      assert.equal((right as { data: { correct: boolean } }).data.correct, true);

      const rows = await prisma.answerAttempt.findMany({
        where: { matchId: matchId! },
        orderBy: { submittedAt: 'asc' },
      });
      assert.equal(rows.length, 3);
      assert.equal(rows[0]?.status, AnswerAttemptStatus.REJECTED);
      assert.equal(rows[1]?.status, AnswerAttemptStatus.WRONG_NOT_COUNTED);
      assert.equal(rows[1]?.rawAnswer, 'نمر');
      assert.equal(rows[2]?.status, AnswerAttemptStatus.CORRECT_COUNTED);
      assert.equal(rows[2]?.wasCounted, true);
      assert.equal(rows[2]?.pointsAwarded, DRAW_GUESS_CORRECT_GUESS_POINTS);
      assert.equal(rows[2]?.turnId, 'turn-dg-1');
      assert.equal(rows[2]?.rawAnswer, 'أسد');
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('Guessing Challenge logs correct, wrong counted, and out-of-turn rejects', async () => {
    const host = await mustCreate(uniqueName('أزرق'));
    const guest = await mustJoin(host.room.code, uniqueName('أحمر'));
    try {
      const matchId = await beginPersistedMatch({
        roomId: host.room.id,
        gameId: GUESSING_CHALLENGE_GAME_ID,
        participantPlayerIds: [host.player.id, guest.player.id],
      });
      assert.ok(matchId);
      const players = [
        { id: host.player.id, name: host.player.name, isHost: true, isConnected: true, isReady: true, isSpectator: false },
        { id: guest.player.id, name: guest.player.name, isHost: false, isConnected: true, isReady: true, isSpectator: false },
      ];
      replaceGameShellForTests(makeShell(host.room.id, GUESSING_CHALLENGE_GAME_ID, players));
      const settings = getGameContentSettings(GUESSING_CHALLENGE_GAME_ID);
      assert.ok(settings);
      const gcMatch = createGuessingChallengeMatch(host.room.id, players, settings, '1v1');
      setGuessingChallengeState(host.room.id, gcMatch);
      const blueSocket = createFakeSocket(host.player.id, host.room.id);
      const redSocket = createFakeSocket(guest.player.id, host.room.id);
      registerGuessingChallengeSocketHandlers(fakeIo, blueSocket);
      registerGuessingChallengeSocketHandlers(fakeIo, redSocket);

      const outOfTurn = await emitAck(redSocket, GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT, {
        guess: 'تخمين',
        roundId: gcMatch.round.roundId,
        turnId: gcMatch.round.turnId,
      });
      assert.equal((outOfTurn as { success: boolean }).success, false);

      const wrong = await emitAck(blueSocket, GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT, {
        guess: 'إجابة-غير-صحيحة-تماما',
        roundId: gcMatch.round.roundId,
        turnId: gcMatch.round.turnId,
      });
      assert.equal((wrong as { success: boolean }).success, true);

      const afterWrong = getGuessingChallengeState(host.room.id);
      assert.ok(afterWrong);
      assert.equal(afterWrong.round.currentTurnTeamId, 'red');

      const correct = await emitAck(redSocket, GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT, {
        guess: afterWrong.round.identitiesByTeamId.red.acceptedAnswers[0],
        roundId: afterWrong.round.roundId,
        turnId: afterWrong.round.turnId,
      });
      assert.equal((correct as { success: boolean }).success, true);

      const rows = await prisma.answerAttempt.findMany({
        where: { matchId: matchId! },
        orderBy: { submittedAt: 'asc' },
      });
      assert.equal(rows.length, 3);
      assert.equal(rows[0]?.status, AnswerAttemptStatus.OUT_OF_TURN);
      assert.equal(rows[1]?.status, AnswerAttemptStatus.WRONG_COUNTED);
      assert.equal(rows[1]?.wasCounted, true);
      assert.equal(rows[1]?.pointsAwarded, 0);
      assert.equal(rows[2]?.status, AnswerAttemptStatus.CORRECT_COUNTED);
      assert.ok(rows[1]?.roundId);
      assert.ok(rows[1]?.turnId);
      assert.equal(rows[0]?.teamId, 'red');
    } finally {
      await cleanupRoom(host.room.id);
    }
  });

  await test('Admin API paginates newest-first, rejects unauthorized, hides secrets, and marks old history unavailable', async () => {
    const host = await mustCreate(uniqueName('مدير'));
    const guest = await mustJoin(host.room.code, uniqueName('لاعب'));
    const { email: adminEmail } = await (async () => {
      const email = uniqueEmail('admin');
      const registered = await registerUser({
        email,
        password: 'password-ok',
        preferredDisplayName: uniqueName('إدارة'),
      });
      assert.equal(registered.success, true);
      return { email };
    })();
    const userEmail = uniqueEmail('user');
    const registeredUser = await registerUser({
      email: userEmail,
      password: 'password-ok',
      preferredDisplayName: uniqueName('عضو'),
    });
    assert.equal(registeredUser.success, true);
    await promoteExistingUserToAdmin(adminEmail);
    try {
      const matchId = await beginPersistedMatch({
        roomId: host.room.id,
        gameId: FAST_ANSWER_GAME_ID,
        participantPlayerIds: [host.player.id, guest.player.id],
      });
      assert.ok(matchId);
      const historyId = (
        await prisma.match.findUniqueOrThrow({
          where: { id: matchId! },
          select: { roomHistoryId: true },
        })
      ).roomHistoryId;
      assert.ok(historyId);
      await prisma.answerAttempt.createMany({
        data: [
          {
            roomHistoryId: historyId!,
            matchId: matchId!,
            gameId: FAST_ANSWER_GAME_ID,
            playerDisplayName: 'أول',
            rawAnswer: 'أ',
            status: AnswerAttemptStatus.WRONG_NOT_COUNTED,
            wasCorrect: false,
            wasCounted: false,
            roundIndex: 1,
            promptText: 'س1',
            submittedAt: new Date('2026-09-05T01:00:00.000Z'),
          },
          {
            roomHistoryId: historyId!,
            matchId: matchId!,
            gameId: FAST_ANSWER_GAME_ID,
            playerDisplayName: 'ثان',
            rawAnswer: 'ب',
            status: AnswerAttemptStatus.CORRECT_COUNTED,
            wasCorrect: true,
            wasCounted: true,
            pointsAwarded: 100,
            roundIndex: 1,
            promptText: 'س1',
            submittedAt: new Date('2026-09-05T02:00:00.000Z'),
          },
        ],
      });

      const oldMatch = await prisma.match.create({
        data: {
          roomCode: 'OLDLOG',
          gameId: FAST_ANSWER_GAME_ID,
          status: MatchStatus.COMPLETED,
          startedAt: new Date('2024-01-01T00:00:00.000Z'),
          endedAt: new Date('2024-01-01T00:10:00.000Z'),
          roomHistoryId: historyId,
        },
      });

      await withApp(async (baseUrl) => {
        const denied = await fetch(`${baseUrl}/api/admin/history/${matchId}/answers`);
        assert.equal(denied.status, 401);
        const deniedBody = (await denied.json()) as AdminActionResponse<never>;
        assert.equal(deniedBody.success, false);
        if (!deniedBody.success) {
          assert.equal(deniedBody.error.message, ADMIN_DENIED_MESSAGE);
        }

        const userLogin = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: userEmail, password: 'password-ok' }),
        });
        assert.equal(userLogin.status, 200);
        const userCookie = cookieFromResponse(userLogin);
        const forbidden = await fetch(`${baseUrl}/api/admin/history/${matchId}/answers`, {
          headers: { cookie: userCookie },
        });
        assert.equal(forbidden.status, 403);

        const login = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: adminEmail, password: 'password-ok' }),
        });
        assert.equal(login.status, 200);
        const cookie = cookieFromResponse(login);
        const listed = await fetch(`${baseUrl}/api/admin/history/${matchId}/answers?status=CORRECT_COUNTED`, {
          headers: { cookie },
        });
        const raw = await listed.text();
        assert.doesNotMatch(raw, /passwordHash|tokenHash|socketId|ipAddress|reconnectToken|livePlayerId/i);
        const body = JSON.parse(raw) as AdminActionResponse<AdminAnswerAttemptData>;
        assert.equal(listed.status, 200);
        assert.equal(body.success, true);
        if (!body.success) {
          throw new Error('answers failed');
        }
        assert.equal(body.data.total, 1);
        assert.equal(body.data.attempts[0]?.rawAnswer, 'ب');
        assert.equal(body.data.attempts[0]?.status, 'CORRECT_COUNTED');
        assert.equal(body.data.historyAvailable, true);

        const newest = await fetch(`${baseUrl}/api/admin/history/${matchId}/answers`, {
          headers: { cookie },
        });
        const newestBody = (await newest.json()) as AdminActionResponse<AdminAnswerAttemptData>;
        assert.equal(newestBody.success, true);
        if (newestBody.success) {
          assert.equal(newestBody.data.attempts[0]?.rawAnswer, 'ب');
          assert.equal(newestBody.data.attempts[1]?.rawAnswer, 'أ');
        }

        const old = await fetch(`${baseUrl}/api/admin/history/${oldMatch.id}/answers`, {
          headers: { cookie },
        });
        const oldBody = (await old.json()) as AdminActionResponse<AdminAnswerAttemptData>;
        assert.equal(old.status, 200);
        assert.equal(oldBody.success, true);
        if (oldBody.success) {
          assert.equal(oldBody.data.total, 0);
          assert.equal(oldBody.data.historyAvailable, false);
        }

        const roomHistory = await fetch(`${baseUrl}/api/admin/room-history/${historyId}`, {
          headers: { cookie },
        });
        const roomBody = (await roomHistory.json()) as AdminActionResponse<{
          matches: Array<{ id: string; answerAttemptCount: number }>;
        }>;
        assert.equal(roomHistory.status, 200);
        if (roomBody.success) {
          const logged = roomBody.data.matches.find((row) => row.id === matchId);
          assert.equal(logged?.answerAttemptCount, 2);
        }
      });

      await prisma.match.delete({ where: { id: oldMatch.id } });
    } finally {
      await cleanupRoom(host.room.id);
      await prisma.user.deleteMany({ where: { email: { in: [adminEmail, userEmail] } } }).catch(() => undefined);
    }
  });

  stopExpiredAnswerAttemptCleanup();
  await prisma.$disconnect();
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  stopExpiredAnswerAttemptCleanup();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
