import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Server } from 'socket.io';

import type { GameShellState, JudgeMatchState } from '@wanasatna/shared';
import { isActiveMatchParticipant } from '@wanasatna/shared';
import {
  absorbSpectatorsAndExpandMatch,
  clearPendingSpectatorPromotionPersistenceForTests,
  expandMatchRoster,
  setSpectatorPromotionPersistenceForTests,
  waitForPendingSpectatorPromotionPersistence,
} from '../src/modules/game/runtime/absorb-spectators-for-next-round.js';
import { persistCompletedMatchThen } from '../src/modules/game/runtime/persist-completed-match.js';
import { deleteGameShell, replaceGameShellForTests } from '../src/modules/game/game.service.js';
import { deleteMarathonState, setMarathonState } from '../src/modules/marathon/marathon.store.js';
import { buildJudgePlayerView } from '../src/modules/game/plugins/judge/state.js';
import type { MatchRosterFields } from '../src/modules/game/runtime/absorb-spectators-for-next-round.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [];

function test(name: string, run: TestCase['run']): void {
  tests.push({ name, run });
}

function fakeIo(): Server {
  return {
    to: () => ({
      emit: () => undefined,
    }),
  } as unknown as Server;
}

function makeShell(
  roomId = 'room-spectator-next-round',
  gameId = 'bara-al-salafa',
): GameShellState {
  return {
    shellId: 'shell-spectator-next-round',
    roomId,
    gameId,
    phase: 'PLAYING',
    hostPlayerId: 'p1',
    matchParticipantIds: ['p1', 'p2'],
    players: [
      {
        id: 'p1',
        name: 'Host',
        isHost: true,
        isReady: true,
        isConnected: true,
        isSpectator: false,
      },
      {
        id: 'p2',
        name: 'Player two',
        isHost: false,
        isReady: true,
        isConnected: true,
        isSpectator: false,
      },
      {
        id: 'spec',
        name: 'Late joiner',
        isHost: false,
        isReady: true,
        isConnected: true,
        isSpectator: true,
      },
    ],
    readyPlayerIds: ['p1', 'p2'],
    countdownSeconds: null,
    countdownRemainingSeconds: null,
    gameTimerSeconds: null,
    gameTimerRemainingSeconds: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function makeRosterMatch(): MatchRosterFields {
  return {
    playerIds: ['p1', 'p2'],
    playerNames: {
      p1: 'Host',
      p2: 'Player two',
    },
    scores: {
      p1: 3,
      p2: 1,
    },
  };
}

function makeJudgeMatch(): JudgeMatchState {
  return {
    playerIds: ['p1', 'p2'],
    playerNames: {
      p1: 'Host',
      p2: 'Player two',
    },
    judgeOrder: ['p1', 'p2'],
    judgeOrderIndex: 0,
    currentRound: 1,
    totalRounds: 2,
    configuredTotalRounds: 2,
    scores: {
      p1: 0,
      p2: 0,
    },
    matchStatus: 'in-progress',
    lockedCategoryId: 'test-category',
    lockedCategoryLabel: 'Test category',
    usedRoundCategoryIds: [],
    departedPlayerIds: [],
    recentPromptIds: [],
    answerSeconds: 60,
    judgeSeconds: 30,
    round: {
      roundId: 'judge-round',
      gamePhase: 'answering',
      phaseRemainingSeconds: 60,
      deadlineAtMs: Date.now() + 60_000,
      judgePlayerId: 'p1',
      promptId: 'judge-prompt',
      prompt: 'A prompt',
      categoryId: 'test-category',
      categoryLabel: 'Test category',
      answers: [],
      shuffledAnswerIds: [],
      winningAnswerId: null,
    },
  };
}

test('the seven normal lifecycles gate promotion to a next round, while Guessing Challenge excludes it', () => {
  const lifecyclePaths: Array<[string, RegExp]> = [
    [
      'src/modules/game/plugins/bara-al-salafa/match-lifecycle.ts',
      /match\.currentRound < match\.totalRounds/,
    ],
    [
      'src/modules/game/plugins/draw-guess/match-lifecycle.ts',
      /match\.currentRound < match\.totalRounds/,
    ],
    [
      'src/modules/game/plugins/imposter-draw/match-lifecycle.ts',
      /match\.currentRound < match\.totalRounds/,
    ],
    [
      'src/modules/game/plugins/timing-challenge/match-lifecycle.ts',
      /match\.currentRound < match\.totalRounds/,
    ],
    [
      'src/modules/game/plugins/fast-answer/match-lifecycle.ts',
      /match\.currentRound < match\.totalRounds/,
    ],
    [
      'src/modules/game/plugins/who-wrote-it/match-lifecycle.ts',
      /match\.currentRound < match\.totalRounds/,
    ],
  ];

  for (const [relativePath, nextRoundGuard] of lifecyclePaths) {
    const source = read(relativePath);
    assert.match(source, /absorbSpectatorsAndExpandMatch/);
    assert.match(source, nextRoundGuard);
  }

  const judge = read('src/modules/game/plugins/judge/match-lifecycle.ts');
  assert.match(judge, /absorbSpectatorsAndExpandMatch/);
  assert.match(
    judge,
    /const resolved = resolveNextRoundJudge\(match\);[\s\S]*?if \(!resolved\)[\s\S]*?const expanded = absorbSpectatorsAndExpandMatch/,
    'Judge must not promote a spectator when its frozen judge order has no next turn',
  );

  const guessingChallenge = read('src/modules/game/plugins/guessing-challenge/match-lifecycle.ts');
  assert.doesNotMatch(
    guessingChallenge,
    /absorbSpectatorsAndExpandMatch/,
    'Guessing Challenge must keep a mid-match joiner spectating for the whole match',
  );
});

test('a connected spectator is promoted once, joins the next roster at zero, and leaves host identity intact', async () => {
  const roomId = 'room-promote-once';
  const shell = makeShell(roomId);
  const match = makeRosterMatch();
  const persistenceCalls: Array<{
    roomId: string;
    matchId: string | null;
    absorbedPlayerIds: string[];
  }> = [];

  setSpectatorPromotionPersistenceForTests(async (input) => {
    persistenceCalls.push(input);
  });
  replaceGameShellForTests(shell);

  try {
    const first = absorbSpectatorsAndExpandMatch(fakeIo(), roomId, match);
    const second = absorbSpectatorsAndExpandMatch(fakeIo(), roomId, first.match);
    await waitForPendingSpectatorPromotionPersistence(roomId);
    const promotedShell = first.shell;
    assert.ok(promotedShell);

    assert.deepEqual(first.absorbedPlayerIds, ['spec']);
    assert.deepEqual(second.absorbedPlayerIds, []);
    assert.deepEqual(first.match.playerIds, ['p1', 'p2', 'spec']);
    assert.equal(first.match.playerNames.spec, 'Late joiner');
    assert.equal(first.match.scores.spec, 0);
    assert.equal(promotedShell.hostPlayerId, 'p1');
    assert.equal(promotedShell.players.find((player) => player.id === 'spec')?.isSpectator, false);
    assert.equal(promotedShell.matchParticipantIds?.filter((id) => id === 'spec').length, 1);
    assert.equal(isActiveMatchParticipant(promotedShell, 'spec'), true);
    assert.equal(persistenceCalls.length, 1);
    assert.deepEqual(persistenceCalls[0]?.absorbedPlayerIds, ['spec']);
  } finally {
    setSpectatorPromotionPersistenceForTests(null);
    clearPendingSpectatorPromotionPersistenceForTests(roomId);
    deleteGameShell(roomId);
  }
});

test('a disconnected spectator is not promoted, and a pre-existing score is never reset', () => {
  const roomId = 'room-disconnected-spectator';
  const shell = makeShell(roomId);
  const spectator = shell.players.find((player) => player.id === 'spec');
  assert.ok(spectator);
  spectator.isConnected = false;
  replaceGameShellForTests(shell);

  try {
    const result = absorbSpectatorsAndExpandMatch(fakeIo(), roomId, makeRosterMatch());
    assert.deepEqual(result.absorbedPlayerIds, []);
    assert.deepEqual(result.match.playerIds, ['p1', 'p2']);

    const promotionShell = makeShell(roomId);
    const promotedSpectator = promotionShell.players.find((player) => player.id === 'spec');
    assert.ok(promotedSpectator);
    promotedSpectator.isSpectator = false;
    const preserved = expandMatchRoster(
      {
        ...makeRosterMatch(),
        scores: {
          p1: 3,
          p2: 1,
          spec: 7,
        },
      },
      promotionShell,
      ['spec'],
    );
    assert.equal(preserved.scores.spec, 7);
  } finally {
    deleteGameShell(roomId);
  }
});

test('Judge late joiners answer as players without changing the frozen judge rotation or match length', () => {
  const shell = makeShell('room-judge', 'judge');
  assert.ok(shell.matchParticipantIds);
  shell.matchParticipantIds.push('spec');
  const spectator = shell.players.find((player) => player.id === 'spec');
  assert.ok(spectator);
  spectator.isSpectator = false;

  const match = expandMatchRoster(makeJudgeMatch(), shell, ['spec']);
  const viewer = buildJudgePlayerView(match, 'spec', shell);

  assert.deepEqual(match.playerIds, ['p1', 'p2', 'spec']);
  assert.equal(match.playerNames.spec, 'Late joiner');
  assert.equal(match.scores.spec, 0);
  assert.deepEqual(match.judgeOrder, ['p1', 'p2']);
  assert.equal(match.totalRounds, 2);
  assert.equal(match.configuredTotalRounds, 2);
  assert.equal(viewer.isMatchSpectator, false);
  assert.equal(viewer.canSubmitAnswer, true);
});

test('marathon matches retain their locked roster', () => {
  const roomId = 'room-marathon-spectator';
  const shell = makeShell(roomId);
  replaceGameShellForTests(shell);
  setMarathonState({
    roomId,
    status: 'PLAYING',
  } as never);

  try {
    const result = absorbSpectatorsAndExpandMatch(fakeIo(), roomId, makeRosterMatch());
    assert.deepEqual(result.absorbedPlayerIds, []);
    assert.deepEqual(result.match.playerIds, ['p1', 'p2']);
  } finally {
    deleteMarathonState(roomId);
    deleteGameShell(roomId);
  }
});

test('completion waits for queued promotion persistence before closing the captured match', async () => {
  const roomId = 'room-promotion-ordering';
  const shell = makeShell(roomId);
  const events: string[] = [];
  let releasePersistence: (() => void) | undefined;
  let markPersistenceStarted: (() => void) | undefined;
  const persistenceStarted = new Promise<void>((resolve) => {
    markPersistenceStarted = resolve;
  });
  const persistenceGate = new Promise<void>((resolve) => {
    releasePersistence = resolve;
  });

  replaceGameShellForTests(shell);
  setSpectatorPromotionPersistenceForTests(async () => {
    events.push('promotion-started');
    markPersistenceStarted?.();
    await persistenceGate;
    events.push('promotion-persisted');
  });

  try {
    absorbSpectatorsAndExpandMatch(fakeIo(), roomId, makeRosterMatch());
    await persistenceStarted;

    const completion = persistCompletedMatchThen(roomId, () => events.push('teardown'), undefined, {
      completeMatch: async () => {
        events.push('match-completed');
        return true;
      },
    });

    assert.deepEqual(events, ['promotion-started', 'teardown']);
    releasePersistence?.();
    await completion;
    assert.deepEqual(events, [
      'promotion-started',
      'teardown',
      'promotion-persisted',
      'match-completed',
    ]);
  } finally {
    setSpectatorPromotionPersistenceForTests(null);
    clearPendingSpectatorPromotionPersistenceForTests(roomId);
    deleteGameShell(roomId);
  }
});

async function main(): Promise<void> {
  for (const current of tests) {
    await current.run();
    process.stdout.write('PASS ' + current.name + '\n');
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    (error instanceof Error ? (error.stack ?? error.message) : String(error)) + '\n',
  );
  process.exitCode = 1;
});
