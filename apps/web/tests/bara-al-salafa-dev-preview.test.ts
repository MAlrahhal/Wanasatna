/**
 * Dev preview module smoke test (no Socket.IO, no browser).
 * Run from apps/web via test:unit.
 */
import assert from 'node:assert/strict';
import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import { BaraAlSalafaDevPreviewClient } from '@/components/dev/bara-al-salafa-dev-preview-client';
import {
  directedQuestionsDemoDefaults,
  roleRevealDemoDefaults,
  roundResultsCorrectDemoDefaults,
} from '@/plugins/bara-al-salafa/role-reveal-demo-data';
import { isStaleBaraRoleView } from '@/plugins/bara-al-salafa/stale-round-view';
import {
  mapDirectedQuestionsLiveProps,
  mapRevealImpostorLiveProps,
  mapRoundResultsLiveProps,
  mapVotingLiveProps,
  resolveFreeQuestionActivePlayerId,
} from '@/plugins/bara-al-salafa/live-phase-adapters';
import type { LobbyPlayer } from '@/lib/lobby/types';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('demo data exports required props for dev preview screens', () => {
  assert.ok(roleRevealDemoDefaults.secretWord);
  assert.ok(directedQuestionsDemoDefaults.askerPlayerId);
  assert.ok(roundResultsCorrectDemoDefaults.roundResults.length > 0);
});

test('dev preview client component is exported for /dev/bara-al-salafa route', () => {
  assert.equal(typeof BaraAlSalafaDevPreviewClient, 'function');
});

test('voting spectators mount a read-only VotingScreen', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const game = readFileSync(join(root, 'plugins/bara-al-salafa/game-screen.tsx'), 'utf8');
  assert.match(game, /treatAsSpectator && \(!view \|\| view\.gamePhase === 'description'\)/);
  const votingBranch = game.slice(game.indexOf("if (view.gamePhase === 'voting')"));
  assert.match(votingBranch, /isMatchSpectator/);
  assert.match(votingBranch, /<VotingScreen/);
  assert.match(votingBranch, /onConfirmVote=\{undefined\}/);
  assert.match(votingBranch, /onSelectPlayer=\{undefined\}/);
  const spectatorReturn = votingBranch.indexOf('WaitingSpectatorScreen');
  const votingScreen = votingBranch.indexOf('<VotingScreen');
  assert.ok(votingScreen >= 0);
  assert.ok(spectatorReturn < 0 || spectatorReturn > votingScreen);
});

test('client round change does not keep the previous round role as current', () => {
  assert.equal(isStaleBaraRoleView(1, null), true);
  assert.equal(
    isStaleBaraRoleView(1, { currentRound: 1, gamePhase: 'round-results' }),
    true,
  );
  assert.equal(
    isStaleBaraRoleView(1, { currentRound: 1, gamePhase: 'description' }),
    true,
  );
  assert.equal(
    isStaleBaraRoleView(1, { currentRound: 2, gamePhase: 'description' }),
    false,
  );
  assert.equal(
    isStaleBaraRoleView(1, { currentRound: 1, gamePhase: 'match-completed' }),
    false,
  );
  assert.equal(isStaleBaraRoleView(null, { currentRound: 1, gamePhase: 'description' }), false);

  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const hook = readFileSync(join(root, 'plugins/bara-al-salafa/use-player-view.ts'), 'utf8');
  assert.match(hook, /currentView\?\.gamePhase === 'round-results'/);
  assert.match(hook, /awaitingRoundFromRef\.current = currentView\.currentRound/);
  assert.match(hook, /isStaleBaraRoleView/);
  assert.match(hook, /setIsLoading\(true\)/);
});

const roomPlayers: LobbyPlayer[] = [
  { id: 'p1', name: 'محمد', isHost: true, isSpectator: false, isConnected: true },
  { id: 'p2', name: 'خالد', isHost: false, isSpectator: false, isConnected: true },
  { id: 'p3', name: 'سارة', isHost: false, isSpectator: false, isConnected: true },
  { id: 'spec', name: 'مشاهد', isHost: false, isSpectator: true, isConnected: true },
];

function spectatorView(overrides: Partial<BaraAlSalafaPlayerView> = {}): BaraAlSalafaPlayerView {
  return {
    role: 'player',
    displayText: '',
    gamePhase: 'directed-questions',
    phaseLabel: 'أسئلة موجهة — الجولة 1/3',
    phaseRemainingSeconds: 20,
    deadlineAtMs: Date.now() + 20_000,
    categoryName: 'أماكن',
    instruction: 'محمد اسأل خالد',
    currentSpeakerName: 'محمد',
    directedQuestionAskerPlayerId: 'p1',
    directedQuestionAskerName: 'محمد',
    directedQuestionTargetPlayerId: 'p2',
    directedQuestionTargetName: 'خالد',
    directedQuestionCurrentTurn: 1,
    directedQuestionTotalTurns: 3,
    isDirectedQuestionActiveAsker: false,
    hasAcknowledgedRole: false,
    roleAcknowledgementCount: 0,
    eligibleRoleAcknowledgementCount: 3,
    isFreeQuestionActivePlayer: false,
    selectablePlayers: [],
    activeFreeQuestionPlayerId: null,
    activeFreeQuestionPlayerName: null,
    activeFreeQuestionTargetPlayerId: null,
    activeFreeQuestionTargetPlayerName: null,
    completedFreeQuestionPlayerIds: [],
    hasVoted: false,
    votablePlayers: [],
    submittedVotesCount: 1,
    eligibleVotersCount: 3,
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
    isMatchSpectator: true,
    spectatorCivilianWord: null,
    spectatorOutsiderConcept: null,
    ...overrides,
  };
}

test('spectator plugin view initializes directed, voting, reveal, and results adapters', () => {
  const directed = mapDirectedQuestionsLiveProps(
    spectatorView(),
    roomPlayers,
    'spec',
    'ABCD',
    Date.now() + 1000,
  );
  assert.ok(directed);
  assert.equal(directed.askerPlayerId, 'p1');
  assert.equal(directed.targetPlayerId, 'p2');
  assert.equal(directed.totalTurns, 3);

  const emptyDirected = mapDirectedQuestionsLiveProps(
    spectatorView({
      directedQuestionAskerPlayerId: null,
      directedQuestionAskerName: null,
      directedQuestionTargetPlayerId: null,
      directedQuestionTargetName: null,
      directedQuestionTotalTurns: 0,
    }),
    roomPlayers,
    'spec',
    'ABCD',
    null,
  );
  assert.equal(emptyDirected, null);

  const voting = mapVotingLiveProps(
    spectatorView({ gamePhase: 'voting' }),
    roomPlayers,
    'spec',
    'ABCD',
    Date.now() + 1000,
    false,
    null,
  );
  assert.equal(voting.isSpectator, true);
  assert.equal(voting.submittedVotesCount, 1);
  assert.equal(voting.eligibleVotersCount, 3);
  assert.equal(voting.hasVoted, false);

  const hiddenReveal = mapRevealImpostorLiveProps(
    spectatorView({ gamePhase: 'reveal-impostor' }),
    'ABCD',
    null,
  );
  assert.equal(hiddenReveal, null);

  const publicReveal = mapRevealImpostorLiveProps(
    spectatorView({
      gamePhase: 'reveal-impostor',
      revealedImpostorPlayerId: 'p2',
      revealedImpostorName: 'خالد',
    }),
    'ABCD',
    null,
  );
  assert.ok(publicReveal);
  assert.equal(publicReveal.impostorPlayer.id, 'p2');

  const hiddenResults = mapRoundResultsLiveProps(
    spectatorView({ gamePhase: 'round-results' }),
    'spec',
    'ABCD',
    null,
  );
  assert.equal(hiddenResults, null);

  const publicResults = mapRoundResultsLiveProps(
    spectatorView({
      gamePhase: 'round-results',
      revealedWord: 'مكة',
      revealedImpostorPlayerId: 'p2',
      revealedImpostorName: 'خالد',
      impostorGuessedCorrectly: false,
      spectatorCivilianWord: 'مكة',
      roundResults: [
        {
          playerId: 'p1',
          name: 'محمد',
          roundPoints: 100,
          totalPoints: 100,
          isImpostor: false,
          earnedPoints: true,
        },
      ],
    }),
    'spec',
    'ABCD',
    null,
  );
  assert.ok(publicResults);
  assert.equal(publicResults.revealedWord, 'مكة');
  assert.equal(publicResults.continueLabel, null);

  const freeActive = resolveFreeQuestionActivePlayerId(
    spectatorView({
      gamePhase: 'free-questions',
      activeFreeQuestionPlayerId: 'p1',
      activeFreeQuestionPlayerName: 'محمد',
    }),
    'spec',
    roomPlayers,
  );
  assert.equal(freeActive, 'p1');
});

test('spectator game-shell and plugin boot stay public and read-only', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const game = readFileSync(join(root, 'plugins/bara-al-salafa/game-screen.tsx'), 'utf8');
  const hook = readFileSync(join(root, 'plugins/bara-al-salafa/use-player-view.ts'), 'utf8');
  const voting = readFileSync(join(root, 'plugins/bara-al-salafa/voting-screen.tsx'), 'utf8');

  assert.match(hook, /BARA_AL_SALAFA_SYNC_EVENT/);
  assert.match(hook, /BARA_AL_SALAFA_PHASE_CHANGED_EVENT/);
  assert.match(hook, /bindPluginViewResync/);
  assert.match(game, /isLoading && !treatAsSpectator/);
  assert.match(game, /categoryLabel: activeView\.categoryName/);
  assert.doesNotMatch(game, /spectatorCivilianWord \/ /);
  assert.match(game, /SpectatorNotice/);
  assert.match(game, /!treatAsSpectator &&[\s\S]*view\.isDirectedQuestionActiveAsker/);
  assert.match(game, /!treatAsSpectator && view\.isFreeQuestionActivePlayer/);
  assert.match(voting, /isSpectator/);
  assert.match(voting, /function VotingSpectatorView/);
  const spectatorVotingFn = voting.slice(voting.indexOf('function VotingSpectatorView'));
  const spectatorVotingEnd = spectatorVotingFn.indexOf('function VotingConfirmedView');
  assert.doesNotMatch(spectatorVotingFn.slice(0, spectatorVotingEnd), /onConfirmVote|onSelectPlayer/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
