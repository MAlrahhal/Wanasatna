/**
 * Refresh / temporary disconnect must not consume the current turn.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/refresh-reconnect-turn.unit.test.ts
 */
import assert from 'node:assert/strict';
import type { Server } from 'socket.io';
import type {
  GameShellState,
  GuessingChallengeMatchState,
  JudgeMatchState,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_GAME_ID,
  JUDGE_GAME_ID,
} from '@wanasatna/shared';
import {
  deleteGameShell,
  replaceGameShellForTests,
} from '../src/modules/game/game.service.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import { ensureGuessingChallengeMatchStateWithTimer } from '../src/modules/game/plugins/guessing-challenge/init-match.js';
import { reconcileGuessingChallengeConnectivity } from '../src/modules/game/plugins/guessing-challenge/match-lifecycle.js';
import { setGuessingChallengeState } from '../src/modules/game/plugins/guessing-challenge/store.js';
import { ensureJudgeMatchStateWithTimer } from '../src/modules/game/plugins/judge/init-match.js';
import { maybeAdvanceAnswering } from '../src/modules/game/plugins/judge/match-lifecycle.js';
import {
  allRequiredHaveAnswered,
  markPlayerDeparted,
  submitAnswerToMatch,
} from '../src/modules/game/plugins/judge/state.js';
import { getJudgeState, setJudgeState } from '../src/modules/game/plugins/judge/store.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

function createFakeIo(): Server {
  return {
    to: () => ({
      emit: () => undefined,
    }),
  } as unknown as Server;
}

function makePlayingShell(
  roomId: string,
  gameId: string,
  playerIds: string[],
  connectedIds = playerIds,
): GameShellState {
  const connected = new Set(connectedIds);
  return {
    shellId: `shell-${roomId}`,
    roomId,
    gameId,
    phase: 'PLAYING',
    hostPlayerId: playerIds[0]!,
    players: playerIds.map((id, index) => ({
      id,
      name: `لاعب${index + 1}`,
      isConnected: connected.has(id),
      isHost: index === 0,
      isReady: true,
    })),
    readyPlayerIds: playerIds,
    countdownSeconds: null,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    updatedAt: new Date().toISOString(),
    matchParticipantIds: playerIds,
  };
}

function makeJudgeMatch(roomId: string, deadlineAtMs: number): JudgeMatchState {
  return {
    playerIds: ['p1', 'p2', 'p3'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'سارة' },
    judgeOrder: ['p1', 'p2', 'p3'],
    judgeOrderIndex: 0,
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    lockedCategoryId: 'general',
    lockedCategoryLabel: 'عام',
    usedRoundCategoryIds: ['general'],
    departedPlayerIds: [],
    recentPromptIds: ['pr1'],
    answerSeconds: 60,
    judgeSeconds: 30,
    configuredTotalRounds: null,
    round: {
      roundId: 'round-1',
      gamePhase: 'answering',
      phaseRemainingSeconds: Math.max(1, Math.ceil((deadlineAtMs - Date.now()) / 1000)),
      deadlineAtMs,
      judgePlayerId: 'p1',
      promptId: 'pr1',
      prompt: 'سؤال',
      categoryId: 'general',
      answers: [],
      shuffledAnswerIds: [],
      winningAnswerId: null,
    },
  };
}

function makeGcMatch(deadlineAtMs: number): GuessingChallengeMatchState {
  return {
    mode: '1v1',
    playerIds: ['p1', 'p2'],
    playerNames: { p1: 'محمد', p2: 'خالد' },
    teamByPlayerId: { p1: 'blue', p2: 'red' },
    seatByPlayerId: { p1: 0, p2: 0 },
    teamCards: {
      blue: { yellowUsed: false, redUsed: false },
      red: { yellowUsed: false, redUsed: false },
    },
    teamScores: { blue: 0, red: 0 },
    scores: { p1: 0, p2: 0 },
    lookByPlayerId: {},
    currentRound: 1,
    totalRounds: 4,
    matchStatus: 'in-progress',
    nextStartingTeamId: 'red',
    lockedCategoryId: 'food',
    lockedCategoryLabel: 'أكل',
    usedRoundCategoryIds: ['food'],
    departedPlayerIds: [],
    recentIdentityIds: [],
    turnSeconds: 45,
    round: {
      roundId: 'round-1',
      turnId: 'turn-1',
      gamePhase: 'playing',
      phaseRemainingSeconds: Math.max(1, Math.ceil((deadlineAtMs - Date.now()) / 1000)),
      deadlineAtMs,
      resolvedCategoryId: 'food',
      identitiesByTeamId: {
        blue: {
          id: 'a',
          categoryId: 'food',
          type: 'text',
          value: 'بيتزا',
          imageUrl: null,
          acceptedAnswers: ['بيتزا'],
        },
        red: {
          id: 'b',
          categoryId: 'food',
          type: 'text',
          value: 'برجر',
          imageUrl: null,
          acceptedAnswers: ['برجر'],
        },
      },
      usedIdentityIds: ['a', 'b'],
      currentTurnTeamId: 'blue',
      startingTeamId: 'blue',
      yellowQuestionsRemaining: null,
      winningTeamId: null,
      winningPlayerId: null,
      winningGuess: null,
      identityChangedNoticeTeamId: null,
      cardConfirm: null,
      scoresApplied: false,
    },
  };
}

function snapshotJudgeTurn(match: JudgeMatchState) {
  return {
    roundId: match.round.roundId,
    gamePhase: match.round.gamePhase,
    currentRound: match.currentRound,
    answerCount: match.round.answers.length,
  };
}

function snapshotGcTurn(match: GuessingChallengeMatchState) {
  return {
    roundId: match.round.roundId,
    turnId: match.round.turnId,
    gamePhase: match.round.gamePhase,
    currentTurnTeamId: match.round.currentTurnTeamId,
  };
}

test(
  'judge: unanswered player refresh + SYNC/ensure does not skip answering; reconnect keeps the same turn',
  () => {
    const roomId = 'room-refresh-judge';
    const io = createFakeIo();
    const deadlineAtMs = Date.now() + 45_000;
    const playerIds = ['p1', 'p2', 'p3'];

    try {
      replaceGameShellForTests(makePlayingShell(roomId, JUDGE_GAME_ID, playerIds));
      let match = submitAnswerToMatch(makeJudgeMatch(roomId, deadlineAtMs), 'p2', 'إجابة خالد');
      setJudgeState(roomId, match);

      replaceGameShellForTests(
        makePlayingShell(roomId, JUDGE_GAME_ID, playerIds, ['p1', 'p2']),
      );
      const disconnectedShell = makePlayingShell(roomId, JUDGE_GAME_ID, playerIds, ['p1', 'p2']);
      assert.equal(allRequiredHaveAnswered(match, disconnectedShell), false);

      const afterDisconnectSync = ensureJudgeMatchStateWithTimer(io, roomId);
      assert.ok(afterDisconnectSync);
      assert.deepEqual(snapshotJudgeTurn(afterDisconnectSync), snapshotJudgeTurn(match));

      const afterSubmitDuringRefresh = maybeAdvanceAnswering(
        io,
        roomId,
        afterDisconnectSync,
        disconnectedShell,
      );
      assert.equal(afterSubmitDuringRefresh.round.gamePhase, 'answering');

      replaceGameShellForTests(makePlayingShell(roomId, JUDGE_GAME_ID, playerIds));
      const afterReconnect = ensureJudgeMatchStateWithTimer(io, roomId);
      assert.ok(afterReconnect);
      assert.deepEqual(snapshotJudgeTurn(afterReconnect), snapshotJudgeTurn(match));
      assert.equal(getJudgeState(roomId)?.round.gamePhase, 'answering');
    } finally {
      cleanupPluginMatchState(roomId, JUDGE_GAME_ID);
      deleteGameShell(roomId);
    }
  },
);

test(
  'judge: permanent leave of the last unanswered player still advances answering',
  () => {
    const roomId = 'room-leave-judge';
    const io = createFakeIo();
    const deadlineAtMs = Date.now() + 45_000;
    const playerIds = ['p1', 'p2', 'p3'];

    try {
      replaceGameShellForTests(makePlayingShell(roomId, JUDGE_GAME_ID, playerIds, ['p1', 'p2']));
      let match = submitAnswerToMatch(makeJudgeMatch(roomId, deadlineAtMs), 'p2', 'إجابة خالد');
      match = markPlayerDeparted(match, 'p3');
      setJudgeState(roomId, match);

      const advanced = maybeAdvanceAnswering(
        io,
        roomId,
        match,
        makePlayingShell(roomId, JUDGE_GAME_ID, playerIds, ['p1', 'p2']),
      );
      assert.notEqual(advanced.round.gamePhase, 'answering');
    } finally {
      cleanupPluginMatchState(roomId, JUDGE_GAME_ID);
      deleteGameShell(roomId);
    }
  },
);

test(
  'guessing-challenge: current-turn refresh + plugin SYNC does not consume the turn',
  () => {
    const roomId = 'room-refresh-gc';
    const io = createFakeIo();
    const deadlineAtMs = Date.now() + 40_000;
    const playerIds = ['p1', 'p2'];
    const before = makeGcMatch(deadlineAtMs);

    try {
      replaceGameShellForTests(makePlayingShell(roomId, GUESSING_CHALLENGE_GAME_ID, playerIds));
      setGuessingChallengeState(roomId, before);

      replaceGameShellForTests(
        makePlayingShell(roomId, GUESSING_CHALLENGE_GAME_ID, playerIds, ['p2']),
      );
      reconcileGuessingChallengeConnectivity(io, roomId);
      const afterDisconnect = ensureGuessingChallengeMatchStateWithTimer(io, roomId);
      assert.ok(afterDisconnect);
      assert.deepEqual(snapshotGcTurn(afterDisconnect), snapshotGcTurn(before));

      replaceGameShellForTests(makePlayingShell(roomId, GUESSING_CHALLENGE_GAME_ID, playerIds));
      reconcileGuessingChallengeConnectivity(io, roomId);
      const afterReconnect = ensureGuessingChallengeMatchStateWithTimer(io, roomId);
      assert.ok(afterReconnect);
      assert.deepEqual(snapshotGcTurn(afterReconnect), snapshotGcTurn(before));
    } finally {
      cleanupPluginMatchState(roomId, GUESSING_CHALLENGE_GAME_ID);
      deleteGameShell(roomId);
    }
  },
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
