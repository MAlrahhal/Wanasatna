/**
 * Unit tests for Bara AlSalafa → shared shell leaderboard mapping.
 * Run: pnpm --filter @wanasatna/server exec tsx ../web/tests/map-bara-leaderboard.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import type { LobbyPlayer } from '../lib/lobby/types';
import { mapBaraAlSalafaLeaderboard } from '../lib/game/map-bara-leaderboard';

const testDir = dirname(fileURLToPath(import.meta.url));

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

const roomPlayers: LobbyPlayer[] = [
  { id: 'p1', name: 'محمد', isHost: true, isSpectator: false, isConnected: true },
  { id: 'p2', name: 'خالد', isHost: false, isSpectator: false, isConnected: true },
  { id: 'p3', name: 'سارة', isHost: false, isSpectator: false, isConnected: true },
];

function baseView(overrides: Partial<BaraAlSalafaPlayerView> = {}): BaraAlSalafaPlayerView {
  return {
    role: 'player',
    displayText: 'سيارة',
    gamePhase: 'description',
    phaseLabel: 'test',
    phaseRemainingSeconds: 0,
    categoryName: null,
    instruction: null,
    currentSpeakerName: null,
    directedQuestionAskerPlayerId: null,
    directedQuestionAskerName: null,
    directedQuestionTargetPlayerId: null,
    directedQuestionTargetName: null,
    directedQuestionCurrentTurn: 0,
    directedQuestionTotalTurns: 0,
    isDirectedQuestionActiveAsker: false,
    hasAcknowledgedRole: false,
    roleAcknowledgementCount: 0,
    eligibleRoleAcknowledgementCount: 0,
    isFreeQuestionActivePlayer: false,
    selectablePlayers: [],
    activeFreeQuestionPlayerId: null,
    activeFreeQuestionPlayerName: null,
    activeFreeQuestionTargetPlayerId: null,
    activeFreeQuestionTargetPlayerName: null,
    completedFreeQuestionPlayerIds: [],
    hasVoted: false,
    votablePlayers: [],
    submittedVotesCount: 0,
    eligibleVotersCount: 0,
    confirmedVoteTargetPlayerId: null,
    currentRound: 1,
    totalRounds: 3,
    matchStatus: 'in-progress',
    revealedImpostorPlayerId: null,
    revealedImpostorName: null,
    isImpostorGuessActivePlayer: false,
    impostorGuessOptions: [],
    hasSubmittedImpostorGuess: false,
    revealedWord: null,
    guessResultMessage: null,
    leaderboard: [],
    roundResults: [],
    resultsLeaderboard: [],
    impostorGuessedCorrectly: null,
    matchPlayerCount: 3,
    isFinalResults: false,
    isHost: false,
    canContinueFromRoundResults: false,
    roundResultsContinueLabel: null,
    roundResultsWaitingMessage: null,
    isMatchSpectator: false,
    ...overrides,
  };
}

test('leaderboard mapping: all participants with zero scores at game start', () => {
  const entries = mapBaraAlSalafaLeaderboard(baseView(), 'p1', roomPlayers);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((entry) => entry.name),
    ['خالد', 'سارة', 'محمد'],
  );
  assert.ok(entries.every((entry) => entry.score === 0));
});

test('leaderboard mapping: higher total score sorts first', () => {
  const entries = mapBaraAlSalafaLeaderboard(
    baseView({
      resultsLeaderboard: [
        { playerId: 'p2', name: 'خالد', totalPoints: 200, rank: 1, isFirstPlace: true },
        { playerId: 'p1', name: 'محمد', totalPoints: 100, rank: 2, isFirstPlace: false },
        { playerId: 'p3', name: 'سارة', totalPoints: 0, rank: 3, isFirstPlace: false },
      ],
    }),
    'p1',
    roomPlayers,
  );

  assert.deepEqual(
    entries.map((entry) => [entry.name, entry.score]),
    [
      ['خالد', 200],
      ['محمد', 100],
      ['سارة', 0],
    ],
  );
});

test('leaderboard mapping: equal score Arabic before English', () => {
  const mixedPlayers: LobbyPlayer[] = [
    { id: 'p1', name: 'Zaid', isHost: false, isSpectator: false, isConnected: true },
    { id: 'p2', name: 'أحمد', isHost: false, isSpectator: false, isConnected: true },
    { id: 'p3', name: 'Sara', isHost: false, isSpectator: false, isConnected: true },
  ];

  const entries = mapBaraAlSalafaLeaderboard(
    baseView({
      resultsLeaderboard: [
        { playerId: 'p1', name: 'Zaid', totalPoints: 100, rank: 1, isFirstPlace: true },
        { playerId: 'p2', name: 'أحمد', totalPoints: 100, rank: 1, isFirstPlace: true },
        { playerId: 'p3', name: 'Sara', totalPoints: 100, rank: 1, isFirstPlace: true },
      ],
    }),
    'p2',
    mixedPlayers,
  );

  assert.deepEqual(
    entries.map((entry) => entry.name),
    ['أحمد', 'Sara', 'Zaid'],
  );
});

test('H round-results phase uses resultsLeaderboard totals immediately', () => {
  const entries = mapBaraAlSalafaLeaderboard(
    baseView({
      gamePhase: 'round-results',
      resultsLeaderboard: [
        { playerId: 'p2', name: 'خالد', totalPoints: 300, rank: 1, isFirstPlace: true },
        { playerId: 'p3', name: 'سارة', totalPoints: 200, rank: 2, isFirstPlace: false },
        { playerId: 'p1', name: 'محمد', totalPoints: 100, rank: 3, isFirstPlace: false },
      ],
    }),
    'p1',
    roomPlayers,
  );

  assert.deepEqual(
    entries.map((entry) => [entry.name, entry.score]),
    [
      ['خالد', 300],
      ['سارة', 200],
      ['محمد', 100],
    ],
  );
});

test('leaderboard mapping: excludes spectators', () => {
  const entries = mapBaraAlSalafaLeaderboard(baseView(), 'p1', [
    ...roomPlayers,
    { id: 'p4', name: 'متفرج', isHost: false, isSpectator: true, isConnected: true },
  ]);
  assert.equal(entries.length, 3);
});

test('I round results screen no longer renders cumulative leaderboard section', () => {
  const source = readFileSync(
    join(testDir, '../plugins/bara-al-salafa/round-results-screen.tsx'),
    'utf8',
  );
  assert.equal(source.includes('الترتيب التراكمي'), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
