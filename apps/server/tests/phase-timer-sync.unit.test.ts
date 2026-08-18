/**
 * P9-B.1: PHASE_CHANGED is a real phase transition, not a 1Hz countdown tick.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/phase-timer-sync.unit.test.ts
 */
import assert from 'node:assert/strict';
import type { Server } from 'socket.io';
import type {
  BaraAlSalafaMatchState,
  DrawGuessMatchState,
  FastAnswerMatchState,
  GameShellState,
  GuessingChallengeMatchState,
  ImposterDrawMatchState,
  JudgeMatchState,
  TimingChallengeMatchState,
  WhoWroteItMatchState,
} from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_PHASE_CHANGED_EVENT,
  DRAW_GUESS_PHASE_CHANGED_EVENT,
  FAST_ANSWER_PHASE_CHANGED_EVENT,
  GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
  IMPOSTER_DRAW_PHASE_CHANGED_EVENT,
  JUDGE_PHASE_CHANGED_EVENT,
  TIMING_CHALLENGE_PHASE_CHANGED_EVENT,
  WHO_WROTE_IT_PHASE_CHANGED_EVENT,
} from '@wanasatna/shared';
import { remainingSecondsFromDeadline } from '../src/modules/game/runtime/phase-deadline.js';
import {
  deleteGameShell,
  replaceGameShellForTests,
} from '../src/modules/game/game.service.js';
import { cleanupPluginMatchState } from '../src/modules/game/runtime/cleanup-plugin-match.js';
import {
  bumpPhaseTimerGeneration,
  registerBaraPhaseExpiredHandler,
  startPhaseTimerIfNeeded,
  stopPhaseTimer,
} from '../src/modules/game/plugins/bara-al-salafa/phase-timer.js';
import { setBaraAlSalafaState } from '../src/modules/game/plugins/bara-al-salafa/store.js';
import {
  buildBaraAlSalafaPlayerView,
  buildBaraAlSalafaSpectatorView,
} from '../src/modules/game/plugins/bara-al-salafa/state.js';
import {
  restartDrawGuessPhaseTimer,
  startDrawGuessPhaseTimerIfNeeded,
  stopDrawGuessPhaseTimer,
} from '../src/modules/game/plugins/draw-guess/phase-timer.js';
import { setDrawGuessState } from '../src/modules/game/plugins/draw-guess/store.js';
import {
  startImposterDrawPhaseTimerIfNeeded,
  stopImposterDrawPhaseTimer,
} from '../src/modules/game/plugins/imposter-draw/phase-timer.js';
import { setImposterDrawState } from '../src/modules/game/plugins/imposter-draw/store.js';
import {
  startFastAnswerPhaseTimerIfNeeded,
  stopFastAnswerPhaseTimer,
} from '../src/modules/game/plugins/fast-answer/phase-timer.js';
import { setFastAnswerState } from '../src/modules/game/plugins/fast-answer/store.js';
import { buildFastAnswerPlayerView } from '../src/modules/game/plugins/fast-answer/state.js';
import {
  startWhoWroteItPhaseTimerIfNeeded,
  stopWhoWroteItPhaseTimer,
} from '../src/modules/game/plugins/who-wrote-it/phase-timer.js';
import { setWhoWroteItState } from '../src/modules/game/plugins/who-wrote-it/store.js';
import {
  startJudgePhaseTimerIfNeeded,
  stopJudgePhaseTimer,
} from '../src/modules/game/plugins/judge/phase-timer.js';
import { setJudgeState } from '../src/modules/game/plugins/judge/store.js';
import {
  startGuessingChallengePhaseTimerIfNeeded,
  stopGuessingChallengePhaseTimer,
} from '../src/modules/game/plugins/guessing-challenge/phase-timer.js';
import { setGuessingChallengeState } from '../src/modules/game/plugins/guessing-challenge/store.js';
import {
  startTimingChallengePhaseTimerIfNeeded,
  stopTimingChallengePhaseTimer,
} from '../src/modules/game/plugins/timing-challenge/phase-timer.js';
import { setTimingChallengeState } from '../src/modules/game/plugins/timing-challenge/store.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`PASS ${name}`);
    })
    .catch((error) => {
      failed += 1;
      console.error(`FAIL ${name}`);
      console.error(error instanceof Error ? error.message : error);
    });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function createFakeIo() {
  const events: Array<{ event: string; payload: unknown }> = [];
  const io = {
    to: () => ({
      emit: (event: string, payload: unknown) => {
        events.push({ event, payload });
      },
    }),
  };
  return { io: io as unknown as Server, events };
}

registerBaraPhaseExpiredHandler((io) => {
  io.to('x').emit(BARA_AL_SALAFA_PHASE_CHANGED_EVENT, {});
});

function makePlayingShell(roomId: string, gameId: string, playerIds = ['p1', 'p2', 'p3']): GameShellState {
  return {
    shellId: `shell-${roomId}`,
    roomId,
    gameId,
    phase: 'PLAYING',
    hostPlayerId: playerIds[0]!,
    players: playerIds.map((id, index) => ({
      id,
      name: `لاعب${index + 1}`,
      isConnected: true,
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

function installShell(roomId: string, gameId: string): void {
  replaceGameShellForTests(makePlayingShell(roomId, gameId));
}

function cleanupRoom(roomId: string, gameId: string): void {
  cleanupPluginMatchState(roomId, gameId);
  deleteGameShell(roomId);
}

function makeBaraMatch(deadlineAtMs: number): BaraAlSalafaMatchState {
  return {
    playerIds: ['p1', 'p2', 'p3'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'علي' },
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    usedWordTexts: ['مكة'],
    round: {
      word: 'مكة',
      wordCategoryId: 'places',
      categoryName: 'أماكن',
      impostorPlayerId: 'p2',
      gamePhase: 'description',
      phaseRemainingSeconds: Math.max(1, Math.ceil((deadlineAtMs - Date.now()) / 1000)),
      deadlineAtMs,
      descriptionDurationSeconds: 20,
      questionTurnDurationSeconds: 60,
      speakingOrder: [],
      directedQuestionPairs: [],
      currentSpeakerIndex: 0,
      activeFreeQuestionPlayerId: null,
      pendingFreeQuestionTargetPlayerId: null,
      completedFreeQuestionTurns: [],
      roleUnderstoodPlayerIds: [],
      votes: {},
      submittedVoterIds: [],
      votingDurationSeconds: 60,
      revealDurationSeconds: 5,
      impostorGuessOptions: [],
      impostorGuessDurationSeconds: 60,
      selectedWord: null,
      guessedCorrectly: null,
      roundResultsDurationSeconds: 10,
      guessResultDurationSeconds: 3,
    },
  };
}

function makeDrawMatch(deadlineAtMs: number): DrawGuessMatchState {
  return {
    playerIds: ['p1', 'p2', 'p3'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'علي' },
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    drawerMode: 'random',
    fixedDrawerPlayerId: null,
    usedWordTexts: ['أسد'],
    round: {
      turnId: 'turn-a',
      word: 'أسد',
      wordCategoryId: 'animals',
      drawerPlayerId: 'p1',
      gamePhase: 'drawing',
      phaseRemainingSeconds: Math.max(1, Math.ceil((deadlineAtMs - Date.now()) / 1000)),
      deadlineAtMs,
      drawingDurationSeconds: 60,
      strokes: [],
      correctGuesserPlayerId: null,
      guessedCorrectly: false,
    },
  };
}

function makeImposterMatch(deadlineAtMs: number): ImposterDrawMatchState {
  return {
    playerIds: ['p1', 'p2', 'p3'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'علي' },
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    usedImageTexts: ['قطة'],
    previousImpostorPlayerId: null,
    round: {
      turnId: 'turn-a',
      imageId: 'img-1',
      imageLabel: 'قطة',
      imageUrl: 'data:image/svg+xml,cat',
      imageCategoryId: 'animals',
      impostorPlayerId: 'p2',
      drawingOrder: ['p1', 'p2', 'p3'],
      currentDrawerIndex: 0,
      currentTurnStrokeIds: [],
      turnDurationSeconds: 15,
      gamePhase: 'briefing',
      phaseRemainingSeconds: Math.max(1, Math.ceil((deadlineAtMs - Date.now()) / 1000)),
      deadlineAtMs,
      strokes: [],
      roleUnderstoodPlayerIds: [],
      votes: {},
      submittedVoterIds: [],
      impostorVotedOut: null,
      impostorGuessOptions: [],
      selectedImageGuess: null,
      impostorGuessedCorrectly: null,
      revealDurationSeconds: 10,
      guessDurationSeconds: 30,
    },
  };
}

function makeFaMatch(deadlineAtMs: number): FastAnswerMatchState {
  return {
    playerIds: ['p1', 'p2', 'p3'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'سامي' },
    currentRound: 1,
    totalRounds: 5,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    lockedCategoryId: 'countries',
    lockedCategoryLabel: 'بلدان',
    usedRoundCategoryIds: ['countries'],
    roundTimeSeconds: 15,
    recentQuestionIds: ['q1'],
    round: {
      roundId: 'round-1',
      gamePhase: 'question',
      phaseRemainingSeconds: Math.max(1, Math.ceil((deadlineAtMs - Date.now()) / 1000)),
      questionId: 'q1',
      question: 'ما عاصمة مصر؟',
      categoryId: 'countries',
      acceptedAnswers: ['القاهرة'],
      deadlineAtMs,
      winnerPlayerId: null,
      timedOut: false,
    },
  };
}

function makeWwiMatch(deadlineAtMs: number): WhoWroteItMatchState {
  return {
    playerIds: ['p1', 'p2', 'p3'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'سامي' },
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    lockedCategoryId: 'general',
    lockedCategoryLabel: 'عام',
    usedRoundCategoryIds: ['general'],
    recentQuestionIds: ['q1'],
    answerSeconds: 60,
    guessSeconds: 30,
    round: {
      roundId: 'round-1',
      gamePhase: 'answering',
      phaseRemainingSeconds: Math.max(1, Math.ceil((deadlineAtMs - Date.now()) / 1000)),
      deadlineAtMs,
      questionId: 'q1',
      question: 'سؤال',
      categoryId: 'general',
      answers: [],
      shuffledAnswerIds: [],
      currentAnswerIndex: 0,
      guessesByPlayerId: {},
    },
  };
}

function makeJudgeMatch(deadlineAtMs: number): JudgeMatchState {
  return {
    playerIds: ['p1', 'p2', 'p3'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'سامي' },
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

function makeTcMatch(deadlineAtMs: number): TimingChallengeMatchState {
  return {
    playerIds: ['p1', 'p2', 'p3'],
    playerNames: { p1: 'محمد', p2: 'خالد', p3: 'سامي' },
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    settings: { mode: 'guess-time', rounds: 3, minSeconds: 3, maxSeconds: 15 },
    round: {
      roundId: 'round-1',
      gamePhase: 'ready',
      phaseRemainingSeconds: Math.max(1, Math.ceil((deadlineAtMs - Date.now()) / 1000)),
      deadlineAtMs,
      targetMs: 5000,
      hiddenStartedAtMs: null,
      hiddenEndsAtMs: null,
      playerStates: {
        p1: {
          ready: false,
          guessMs: null,
          timerStartedAtMs: null,
          stoppedAtMs: null,
          elapsedMs: null,
          errorMs: null,
          signedDeltaMs: null,
        },
        p2: {
          ready: false,
          guessMs: null,
          timerStartedAtMs: null,
          stoppedAtMs: null,
          elapsedMs: null,
          errorMs: null,
          signedDeltaMs: null,
        },
        p3: {
          ready: false,
          guessMs: null,
          timerStartedAtMs: null,
          stoppedAtMs: null,
          elapsedMs: null,
          errorMs: null,
          signedDeltaMs: null,
        },
      },
    },
  };
}

async function main(): Promise<void> {
await test('deadline helper derives remaining without server ticks', () => {
  const deadline = 1_000_000 + 4500;
  assert.equal(remainingSecondsFromDeadline(deadline, 1_000_000), 5);
  assert.equal(remainingSecondsFromDeadline(deadline, 1_000_000 + 1200), 4);
  assert.equal(remainingSecondsFromDeadline(null), 0);
});

await test('bara player view exposes deadlineAtMs for countdown', () => {
  const deadline = Date.now() + 12_000;
  const match = makeBaraMatch(deadline);
  const view = buildBaraAlSalafaPlayerView(match, 'p1', makePlayingShell('room-bara-view', 'bara-al-salafa'));
  assert.equal(view.deadlineAtMs, deadline);
  assert.ok(view.phaseRemainingSeconds <= 12);
  assert.ok(view.phaseRemainingSeconds >= 11);
});

await test('fast-answer player view exposes deadlineAtMs during question', () => {
  const deadline = Date.now() + 15_000;
  const match = makeFaMatch(deadline);
  const view = buildFastAnswerPlayerView(match, 'p1', makePlayingShell('room-fa-view', 'fast-answer'));
  assert.equal(view.deadlineAtMs, deadline);
  assert.equal(view.questionDeadlineAtMs, deadline);
});

type TimerCase = {
  name: string;
  gameId: string;
  event: string;
  install: (roomId: string, deadlineAtMs: number) => void;
  start: (io: Server, roomId: string) => void;
  stop: (roomId: string) => void;
  mutatePhase: (roomId: string) => void;
};

const cases: TimerCase[] = [
  {
    name: 'bara',
    gameId: 'bara-al-salafa',
    event: BARA_AL_SALAFA_PHASE_CHANGED_EVENT,
    install: (roomId, deadlineAtMs) => setBaraAlSalafaState(roomId, makeBaraMatch(deadlineAtMs)),
    start: startPhaseTimerIfNeeded,
    stop: stopPhaseTimer,
    mutatePhase: (roomId) => {
      const match = makeBaraMatch(Date.now() + 60_000);
      match.round.gamePhase = 'voting';
      setBaraAlSalafaState(roomId, match);
    },
  },
  {
    name: 'draw-guess',
    gameId: 'draw-guess',
    event: DRAW_GUESS_PHASE_CHANGED_EVENT,
    install: (roomId, deadlineAtMs) => setDrawGuessState(roomId, makeDrawMatch(deadlineAtMs)),
    start: startDrawGuessPhaseTimerIfNeeded,
    stop: stopDrawGuessPhaseTimer,
    mutatePhase: (roomId) => {
      const match = makeDrawMatch(Date.now() + 60_000);
      match.round.gamePhase = 'round-results';
      setDrawGuessState(roomId, match);
    },
  },
  {
    name: 'imposter-draw',
    gameId: 'imposter-draw',
    event: IMPOSTER_DRAW_PHASE_CHANGED_EVENT,
    install: (roomId, deadlineAtMs) => setImposterDrawState(roomId, makeImposterMatch(deadlineAtMs)),
    start: startImposterDrawPhaseTimerIfNeeded,
    stop: stopImposterDrawPhaseTimer,
    mutatePhase: (roomId) => {
      const match = makeImposterMatch(Date.now() + 60_000);
      match.round.gamePhase = 'voting';
      setImposterDrawState(roomId, match);
    },
  },
  {
    name: 'fast-answer',
    gameId: 'fast-answer',
    event: FAST_ANSWER_PHASE_CHANGED_EVENT,
    install: (roomId, deadlineAtMs) => setFastAnswerState(roomId, makeFaMatch(deadlineAtMs)),
    start: startFastAnswerPhaseTimerIfNeeded,
    stop: stopFastAnswerPhaseTimer,
    mutatePhase: (roomId) => {
      const match = makeFaMatch(Date.now() + 60_000);
      match.round.gamePhase = 'round-results';
      setFastAnswerState(roomId, match);
    },
  },
  {
    name: 'who-wrote-it',
    gameId: 'who-wrote-it',
    event: WHO_WROTE_IT_PHASE_CHANGED_EVENT,
    install: (roomId, deadlineAtMs) => setWhoWroteItState(roomId, makeWwiMatch(deadlineAtMs)),
    start: startWhoWroteItPhaseTimerIfNeeded,
    stop: stopWhoWroteItPhaseTimer,
    mutatePhase: (roomId) => {
      const match = makeWwiMatch(Date.now() + 60_000);
      match.round.gamePhase = 'round-results';
      setWhoWroteItState(roomId, match);
    },
  },
  {
    name: 'judge',
    gameId: 'judge',
    event: JUDGE_PHASE_CHANGED_EVENT,
    install: (roomId, deadlineAtMs) => setJudgeState(roomId, makeJudgeMatch(deadlineAtMs)),
    start: startJudgePhaseTimerIfNeeded,
    stop: stopJudgePhaseTimer,
    mutatePhase: (roomId) => {
      const match = makeJudgeMatch(Date.now() + 60_000);
      match.round.gamePhase = 'round-results';
      setJudgeState(roomId, match);
    },
  },
  {
    name: 'guessing-challenge',
    gameId: 'guessing-challenge',
    event: GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
    install: (roomId, deadlineAtMs) => setGuessingChallengeState(roomId, makeGcMatch(deadlineAtMs)),
    start: startGuessingChallengePhaseTimerIfNeeded,
    stop: stopGuessingChallengePhaseTimer,
    mutatePhase: (roomId) => {
      const match = makeGcMatch(Date.now() + 60_000);
      match.round.gamePhase = 'round-results';
      setGuessingChallengeState(roomId, match);
    },
  },
  {
    name: 'timing-challenge',
    gameId: 'timing-challenge',
    event: TIMING_CHALLENGE_PHASE_CHANGED_EVENT,
    install: (roomId, deadlineAtMs) => setTimingChallengeState(roomId, makeTcMatch(deadlineAtMs)),
    start: startTimingChallengePhaseTimerIfNeeded,
    stop: stopTimingChallengePhaseTimer,
    mutatePhase: (roomId) => {
      const match = makeTcMatch(Date.now() + 60_000);
      match.round.gamePhase = 'round-results';
      setTimingChallengeState(roomId, match);
    },
  },
];

await test('no 1Hz PHASE_CHANGED during a multi-second timed phase (all games)', async () => {
  const runs = cases.map(async (timerCase) => {
    const roomId = `room-${timerCase.name}-notick`;
    const { io, events } = createFakeIo();
    installShell(roomId, timerCase.gameId);
    timerCase.install(roomId, Date.now() + 2500);
    timerCase.start(io, roomId);
    await sleep(1100);
    const ticks = events.filter((event) => event.event === timerCase.event);
    timerCase.stop(roomId);
    cleanupRoom(roomId, timerCase.gameId);
    assert.equal(
      ticks.length,
      0,
      `${timerCase.name} emitted ${ticks.length} countdown PHASE_CHANGED events`,
    );
  });

  await Promise.all(runs);
});

await test('stale expiry callback cannot mutate a newer phase (all games)', async () => {
  const runs = cases.map(async (timerCase) => {
    const roomId = `room-${timerCase.name}-stale`;
    const { io, events } = createFakeIo();
    installShell(roomId, timerCase.gameId);
    timerCase.install(roomId, Date.now() + 80);
    timerCase.start(io, roomId);
    timerCase.mutatePhase(roomId);
    await sleep(200);
    const ticks = events.filter((event) => event.event === timerCase.event);
    timerCase.stop(roomId);
    cleanupRoom(roomId, timerCase.gameId);
    assert.equal(ticks.length, 0, `${timerCase.name} stale timer emitted PHASE_CHANGED`);
  });

  await Promise.all(runs);
});

await test('early stop cancels expiry (host next / all acted) (all games)', async () => {
  const runs = cases.map(async (timerCase) => {
    const roomId = `room-${timerCase.name}-early`;
    const { io, events } = createFakeIo();
    installShell(roomId, timerCase.gameId);
    timerCase.install(roomId, Date.now() + 80);
    timerCase.start(io, roomId);
    timerCase.stop(roomId);
    await sleep(200);
    const ticks = events.filter((event) => event.event === timerCase.event);
    cleanupRoom(roomId, timerCase.gameId);
    assert.equal(ticks.length, 0, `${timerCase.name} early-stop timer still fired`);
  });

  await Promise.all(runs);
});

await test('bara natural timeout emits PHASE_CHANGED once via expire handler', async () => {
  const roomId = 'room-bara-expire';
  const { io, events } = createFakeIo();
  let expired = 0;
  registerBaraPhaseExpiredHandler(() => {
    expired += 1;
    io.to('x').emit(BARA_AL_SALAFA_PHASE_CHANGED_EVENT, {});
  });
  installShell(roomId, 'bara-al-salafa');
  setBaraAlSalafaState(roomId, makeBaraMatch(Date.now() + 80));
  startPhaseTimerIfNeeded(io, roomId);
  await sleep(200);
  stopPhaseTimer(roomId);
  cleanupRoom(roomId, 'bara-al-salafa');
  registerBaraPhaseExpiredHandler(() => undefined);
  assert.equal(expired, 1);
  assert.equal(events.filter((event) => event.event === BARA_AL_SALAFA_PHASE_CHANGED_EVENT).length, 1);
});

await test('draw-guess natural timeout emits a real PHASE_CHANGED once', async () => {
  const roomId = 'room-draw-expire';
  const { io, events } = createFakeIo();
  installShell(roomId, 'draw-guess');
  setDrawGuessState(roomId, makeDrawMatch(Date.now() + 80));
  startDrawGuessPhaseTimerIfNeeded(io, roomId);
  await sleep(200);
  const phaseEvents = events.filter((event) => event.event === DRAW_GUESS_PHASE_CHANGED_EVENT);
  stopDrawGuessPhaseTimer(roomId);
  cleanupRoom(roomId, 'draw-guess');
  assert.equal(phaseEvents.length, 1);
});

await test('fast-answer natural timeout emits a real PHASE_CHANGED once', async () => {
  const roomId = 'room-fa-expire';
  const { io, events } = createFakeIo();
  installShell(roomId, 'fast-answer');
  setFastAnswerState(roomId, makeFaMatch(Date.now() + 80));
  startFastAnswerPhaseTimerIfNeeded(io, roomId);
  await sleep(200);
  const phaseEvents = events.filter((event) => event.event === FAST_ANSWER_PHASE_CHANGED_EVENT);
  stopFastAnswerPhaseTimer(roomId);
  cleanupRoom(roomId, 'fast-answer');
  assert.equal(phaseEvents.length, 1);
});

await test('who-wrote-it / judge / imposter / gc / timing natural timeout emit once', async () => {
  const suites = [
    {
      name: 'wwi',
      gameId: 'who-wrote-it',
      event: WHO_WROTE_IT_PHASE_CHANGED_EVENT,
      install: setWhoWroteItState,
      make: makeWwiMatch,
      start: startWhoWroteItPhaseTimerIfNeeded,
      stop: stopWhoWroteItPhaseTimer,
    },
    {
      name: 'judge',
      gameId: 'judge',
      event: JUDGE_PHASE_CHANGED_EVENT,
      install: setJudgeState,
      make: makeJudgeMatch,
      start: startJudgePhaseTimerIfNeeded,
      stop: stopJudgePhaseTimer,
    },
    {
      name: 'imposter',
      gameId: 'imposter-draw',
      event: IMPOSTER_DRAW_PHASE_CHANGED_EVENT,
      install: setImposterDrawState,
      make: makeImposterMatch,
      start: startImposterDrawPhaseTimerIfNeeded,
      stop: stopImposterDrawPhaseTimer,
    },
    {
      name: 'gc',
      gameId: 'guessing-challenge',
      event: GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
      install: setGuessingChallengeState,
      make: makeGcMatch,
      start: startGuessingChallengePhaseTimerIfNeeded,
      stop: stopGuessingChallengePhaseTimer,
    },
    {
      name: 'tc',
      gameId: 'timing-challenge',
      event: TIMING_CHALLENGE_PHASE_CHANGED_EVENT,
      install: setTimingChallengeState,
      make: makeTcMatch,
      start: startTimingChallengePhaseTimerIfNeeded,
      stop: stopTimingChallengePhaseTimer,
    },
  ] as const;

  for (const suite of suites) {
    const roomId = `room-${suite.name}-expire`;
    const { io, events } = createFakeIo();
    installShell(roomId, suite.gameId);
    suite.install(roomId, suite.make(Date.now() + 80));
    suite.start(io, roomId);
    await sleep(200);
    const phaseEvents = events.filter((event) => event.event === suite.event);
    suite.stop(roomId);
    cleanupRoom(roomId, suite.gameId);
    assert.ok(phaseEvents.length >= 1, `${suite.name} natural expiry emitted no PHASE_CHANGED`);
    assert.ok(phaseEvents.length <= 2, `${suite.name} natural expiry over-emitted (${phaseEvents.length})`);
  }
});

await test('Game A timer cannot fire after Game A → Game B cleanup', async () => {
  const roomId = 'room-cross-game';
  const { io, events } = createFakeIo();
  let baraExpired = 0;
  registerBaraPhaseExpiredHandler(() => {
    baraExpired += 1;
  });
  installShell(roomId, 'bara-al-salafa');
  setBaraAlSalafaState(roomId, makeBaraMatch(Date.now() + 80));
  startPhaseTimerIfNeeded(io, roomId);
  cleanupPluginMatchState(roomId, 'bara-al-salafa');
  installShell(roomId, 'draw-guess');
  setDrawGuessState(roomId, makeDrawMatch(Date.now() + 5_000));
  startDrawGuessPhaseTimerIfNeeded(io, roomId);
  await sleep(200);
  stopDrawGuessPhaseTimer(roomId);
  cleanupRoom(roomId, 'draw-guess');
  registerBaraPhaseExpiredHandler(() => undefined);
  assert.equal(baraExpired, 0);
  assert.equal(
    events.filter((event) => event.event === BARA_AL_SALAFA_PHASE_CHANGED_EVENT).length,
    0,
  );
});

await test('bara generation bump ignores a previously scheduled timeout', async () => {
  const roomId = 'room-bara-gen';
  const { io } = createFakeIo();
  let expired = 0;
  registerBaraPhaseExpiredHandler(() => {
    expired += 1;
  });
  installShell(roomId, 'bara-al-salafa');
  setBaraAlSalafaState(roomId, makeBaraMatch(Date.now() + 80));
  startPhaseTimerIfNeeded(io, roomId);
  bumpPhaseTimerGeneration(roomId);
  await sleep(200);
  stopPhaseTimer(roomId);
  cleanupRoom(roomId, 'bara-al-salafa');
  registerBaraPhaseExpiredHandler(() => undefined);
  assert.equal(expired, 0);
});

await test('draw-guess restart after host continue cannot double-fire old drawing timer', async () => {
  const roomId = 'room-draw-restart';
  const { io, events } = createFakeIo();
  installShell(roomId, 'draw-guess');
  setDrawGuessState(roomId, makeDrawMatch(Date.now() + 80));
  startDrawGuessPhaseTimerIfNeeded(io, roomId);
  const next = makeDrawMatch(Date.now() + 5_000);
  next.round.gamePhase = 'round-results';
  next.round.turnId = 'turn-b';
  setDrawGuessState(roomId, next);
  restartDrawGuessPhaseTimer(io, roomId);
  await sleep(200);
  stopDrawGuessPhaseTimer(roomId);
  cleanupRoom(roomId, 'draw-guess');
  assert.equal(events.filter((event) => event.event === DRAW_GUESS_PHASE_CHANGED_EVENT).length, 0);
});

await test('reconnect/SYNC derives remaining from deadline without tick catch-up', () => {
  const deadline = Date.now() + 10_000;
  const match = makeBaraMatch(deadline);
  const syncedNow = Date.now();
  const remainingAtReconnect = remainingSecondsFromDeadline(deadline, syncedNow);
  const remainingLater = remainingSecondsFromDeadline(deadline, syncedNow + 1500);
  assert.ok(remainingAtReconnect >= 9);
  assert.ok(remainingLater < remainingAtReconnect);

  const playerView = buildBaraAlSalafaPlayerView(
    match,
    'p1',
    makePlayingShell('room-reconnect', 'bara-al-salafa'),
  );
  const spectatorView = buildBaraAlSalafaSpectatorView(match);
  assert.equal(playerView.deadlineAtMs, deadline);
  assert.equal(spectatorView.deadlineAtMs, deadline);
  assert.equal(spectatorView.isMatchSpectator, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
}

void main();
