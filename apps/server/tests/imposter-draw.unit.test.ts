/**
 * Unit tests for Imposter Draw (الإمبوستر بالرسم) P4.3 rules.
 * Run: pnpm --filter @wanasatna/server test:imposter-draw
 */
import assert from 'node:assert/strict';
import type {
  DrawStroke,
  ImposterDrawMatchState,
  ImposterDrawRoundState,
  GameShellState,
} from '@wanasatna/shared';
import {
  IMPOSTER_DRAW_BRIEFING_SECONDS,
  IMPOSTER_DRAW_DEFAULT_ROUNDS,
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_GUESS_SECONDS,
  IMPOSTER_DRAW_TURN_SECONDS,
  IMPOSTER_DRAW_VOTING_SECONDS,
} from '@wanasatna/shared';
import { registerGameContent } from '../src/modules/content/registry.js';
import { timedPhaseDurations } from '../src/config/test-timers.js';
import {
  applyRoundScores,
  IMPOSTER_DRAW_POINTS,
} from '../src/modules/game/plugins/imposter-draw/scoring.js';
import {
  buildImposterDrawPlayerView,
  buildImposterDrawSpectatorView,
  createMatchState,
  createRoundState,
  pickImpostorPlayerId,
  resolveTotalRounds,
  resolveTurnDurationSeconds,
  serializeImposterDrawState,
  withRound,
} from '../src/modules/game/plugins/imposter-draw/state.js';
import { resolveImpostorVotedOut } from '../src/modules/game/plugins/imposter-draw/voting.js';

registerGameContent(IMPOSTER_DRAW_GAME_ID);

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

function makePlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `لاعب${index + 1}`,
    isConnected: true,
    isHost: index === 0,
    isReady: true,
  }));
}

function makeShell(hostPlayerId = 'p1', playerCount = 3): GameShellState {
  return {
    shellId: 'shell-1',
    roomId: 'room-1',
    gameId: IMPOSTER_DRAW_GAME_ID,
    hostPlayerId,
    phase: 'PLAYING',
    countdownRemainingSeconds: null,
    gameTimerRemainingSeconds: null,
    players: makePlayers(playerCount).map((player) => ({
      ...player,
      isHost: player.id === hostPlayerId,
    })),
    matchParticipantIds: makePlayers(playerCount).map((player) => player.id),
    readyPlayerIds: makePlayers(playerCount).map((player) => player.id),
    countdownSeconds: null,
    gameTimerSeconds: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function makeRound(overrides: Partial<ImposterDrawRoundState> = {}): ImposterDrawRoundState {
  return {
    turnId: 'turn-a',
    imageId: 'img-1',
    imageLabel: 'قطة',
    imageUrl: 'data:image/svg+xml,cat',
    imageCategoryId: 'animals',
    impostorPlayerId: 'p2',
    drawingOrder: ['p1', 'p2', 'p3'],
    currentDrawerIndex: 0,
    currentTurnStrokeIds: [],
    turnDurationSeconds: IMPOSTER_DRAW_TURN_SECONDS,
    gamePhase: 'briefing',
    phaseRemainingSeconds: IMPOSTER_DRAW_BRIEFING_SECONDS,
    strokes: [],
    roleUnderstoodPlayerIds: [],
    votes: {},
    submittedVoterIds: [],
    impostorVotedOut: null,
    impostorGuessOptions: [],
    selectedImageGuess: null,
    impostorGuessedCorrectly: null,
    revealDurationSeconds: 10,
    guessDurationSeconds: IMPOSTER_DRAW_GUESS_SECONDS,
    ...overrides,
  };
}

function makeMatch(overrides: Partial<ImposterDrawMatchState> = {}): ImposterDrawMatchState {
  const players = makePlayers(3);
  return {
    playerIds: players.map((player) => player.id),
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: IMPOSTER_DRAW_DEFAULT_ROUNDS,
    scores: Object.fromEntries(players.map((player) => [player.id, 0])),
    matchStatus: 'in-progress',
    usedImageTexts: ['قطة'],
    previousImpostorPlayerId: null,
    round: makeRound(),
    ...overrides,
  };
}

test('3-player match starts in briefing with 3 rounds', () => {
  const match = createMatchState('room-1', makePlayers(3), {
    minPlayers: 3,
    maxPlayers: 8,
    rounds: 3,
    roundTime: 15,
    enabledCategories: [],
  });
  assert.equal(match.playerIds.length, 3);
  assert.equal(match.totalRounds, 3);
  assert.equal(resolveTotalRounds(), 3);
  assert.equal(match.round.gamePhase, 'briefing');
  assert.equal(match.round.drawingOrder.length, 3);
  assert.ok(match.playerIds.includes(match.round.impostorPlayerId));
});

test('8-player match can start', () => {
  const match = createMatchState('room-1', makePlayers(8), {
    minPlayers: 3,
    maxPlayers: 8,
    rounds: 3,
    roundTime: 15,
    enabledCategories: [],
  });
  assert.equal(match.playerIds.length, 8);
  assert.equal(match.round.drawingOrder.length, 8);
});

test('drawing turn duration resolves from 15s production constant', () => {
  assert.equal(IMPOSTER_DRAW_TURN_SECONDS, 15);
  assert.equal(resolveTurnDurationSeconds(), timedPhaseDurations.imposterDrawTurn());
});

test('crew sees image only during briefing; impostor never does', () => {
  const match = makeMatch();
  const shell = makeShell();

  const crew = buildImposterDrawPlayerView(match, 'p1', shell);
  assert.equal(crew.role, 'crew');
  assert.ok(crew.referenceImage);
  assert.equal(crew.referenceImage?.label, 'قطة');

  const impostor = buildImposterDrawPlayerView(match, 'p2', shell);
  assert.equal(impostor.role, 'impostor');
  assert.equal(impostor.referenceImage, null);

  const drawingMatch = withRound(match, {
    ...match.round,
    gamePhase: 'drawing-turns',
    phaseRemainingSeconds: 15,
  });
  const crewDrawing = buildImposterDrawPlayerView(drawingMatch, 'p1', shell);
  assert.equal(crewDrawing.referenceImage, null);
  assert.equal(buildImposterDrawPlayerView(drawingMatch, 'p2', shell).referenceImage, null);
});

test('reveal and guess phases never expose reference image', () => {
  const shell = makeShell();
  const revealMatch = makeMatch({
    round: makeRound({
      gamePhase: 'reveal',
      impostorVotedOut: false,
      phaseRemainingSeconds: 10,
    }),
  });
  const revealView = buildImposterDrawPlayerView(revealMatch, 'p1', shell);
  assert.equal(revealView.referenceImage, null);
  assert.equal(revealView.revealedImpostorPlayerId, 'p2');
  assert.equal(revealView.revealedAnswerLabel, null);

  const guessMatch = makeMatch({
    round: makeRound({
      gamePhase: 'impostor-guess',
      impostorVotedOut: false,
      impostorGuessOptions: ['قطة', 'كلب', 'أسد'],
      phaseRemainingSeconds: 30,
    }),
  });
  const impostorGuess = buildImposterDrawPlayerView(guessMatch, 'p2', shell);
  assert.equal(impostorGuess.referenceImage, null);
  assert.equal(impostorGuess.revealedAnswerLabel, null);
  assert.deepEqual(impostorGuess.impostorGuessOptions, ['قطة', 'كلب', 'أسد']);
  assert.ok(!impostorGuess.impostorGuessOptions.includes(guessMatch.round.imageUrl));
});

test('guess-result messages and answer label after resolve', () => {
  const shell = makeShell();
  const correct = makeMatch({
    round: makeRound({
      gamePhase: 'guess-result',
      impostorVotedOut: false,
      selectedImageGuess: 'قطة',
      impostorGuessedCorrectly: true,
    }),
  });
  assert.equal(
    buildImposterDrawPlayerView(correct, 'p1', shell).guessResultMessage,
    'إجابة صحيحة!',
  );
  assert.equal(buildImposterDrawPlayerView(correct, 'p1', shell).revealedAnswerLabel, 'قطة');

  const wrong = makeMatch({
    round: makeRound({
      gamePhase: 'guess-result',
      impostorVotedOut: true,
      selectedImageGuess: null,
      impostorGuessedCorrectly: false,
    }),
  });
  assert.equal(
    buildImposterDrawPlayerView(wrong, 'p1', shell).guessResultMessage,
    'إجابة خاطئة!',
  );
});

test('player view has no vote distribution field', () => {
  const shell = makeShell();
  const view = buildImposterDrawPlayerView(
    makeMatch({
      round: makeRound({
        gamePhase: 'reveal',
        impostorVotedOut: true,
        votes: { p1: 'p2', p3: 'p2' },
        submittedVoterIds: ['p1', 'p3'],
      }),
    }),
    'p1',
    shell,
  );
  assert.equal('voteTally' in view, false);
});

test('tie vote means impostor survives', () => {
  const match = makeMatch({
    round: makeRound({
      votes: { p1: 'p2', p3: 'p1' },
      submittedVoterIds: ['p1', 'p3'],
    }),
  });
  assert.equal(resolveImpostorVotedOut(match), false);
});

test('unique majority on impostor votes them out', () => {
  const match = makeMatch({
    round: makeRound({
      votes: { p1: 'p2', p3: 'p2' },
      submittedVoterIds: ['p1', 'p3'],
    }),
  });
  assert.equal(resolveImpostorVotedOut(match), true);
});

test('scoring: crew +100 correct vote; impostor survive + guess', () => {
  const match = makeMatch({
    round: makeRound({
      impostorVotedOut: false,
      votes: { p1: 'p2', p3: 'p1' },
      impostorGuessedCorrectly: true,
    }),
  });
  const scored = applyRoundScores(match);
  assert.equal(scored.scores.p1, IMPOSTER_DRAW_POINTS);
  assert.equal(scored.scores.p3, 0);
  assert.equal(scored.scores.p2, IMPOSTER_DRAW_POINTS * 2);
});

test('prefer avoiding consecutive impostor when alternatives exist', () => {
  const picks = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    picks.add(pickImpostorPlayerId(['p1', 'p2', 'p3'], 'p2'));
  }
  assert.equal(picks.has('p2'), false);
  assert.ok(picks.has('p1') || picks.has('p3'));
});

test('new round resets canvas and records used image', () => {
  const first = createRoundState('room-1', {
    playerIds: ['p1', 'p2', 'p3'],
    usedImageTexts: [],
    previousImpostorPlayerId: null,
  });
  assert.equal(first.round.strokes.length, 0);
  assert.equal(first.round.gamePhase, 'briefing');

  const second = createRoundState('room-1', {
    playerIds: ['p1', 'p2', 'p3'],
    usedImageTexts: first.usedImageTexts,
    previousImpostorPlayerId: first.round.impostorPlayerId,
  });
  assert.equal(second.round.strokes.length, 0);
  if (first.usedImageTexts.length > 0 && second.usedImageTexts.length > 1) {
    assert.notEqual(second.round.imageLabel, first.round.imageLabel);
  }
});

test('spectator privacy: no image, no answer, no impostor before reveal, no score', () => {
  const spectator = buildImposterDrawSpectatorView(makeMatch());
  assert.equal(spectator.isMatchSpectator, true);
  assert.equal(spectator.referenceImage, null);
  assert.equal(spectator.revealedAnswerLabel, null);
  assert.equal(spectator.revealedImpostorPlayerId, null);
  assert.equal(spectator.canDraw, false);
  assert.equal(spectator.canGuessImage, false);
  assert.deepEqual(spectator.leaderboard, []);
  assert.deepEqual(spectator.votablePlayers, []);
});

test('serialize blanks secrets', () => {
  const serialized = serializeImposterDrawState(makeMatch());
  assert.equal(serialized.round.imageLabel, '');
  assert.equal(serialized.round.imageUrl, '');
  assert.equal(serialized.round.impostorPlayerId, '');
});

test('voting duration constant is 60s', () => {
  assert.equal(IMPOSTER_DRAW_VOTING_SECONDS, 60);
  assert.equal(IMPOSTER_DRAW_GUESS_SECONDS, 30);
  assert.equal(IMPOSTER_DRAW_BRIEFING_SECONDS, 20);
});

test('current-turn stroke ownership list supports undo semantics', () => {
  const strokes: DrawStroke[] = [
    { id: 's1', tool: 'draw', color: '#000', size: 4, points: [{ x: 0.1, y: 0.1 }] },
    { id: 's2', tool: 'draw', color: '#000', size: 4, points: [{ x: 0.2, y: 0.2 }] },
    { id: 's3', tool: 'draw', color: '#000', size: 4, points: [{ x: 0.3, y: 0.3 }] },
  ];
  const match = makeMatch({
    round: makeRound({
      gamePhase: 'drawing-turns',
      currentDrawerIndex: 1,
      turnId: 'turn-b',
      strokes,
      currentTurnStrokeIds: ['s2', 's3'],
    }),
  });

  const strokeIdToRemove = match.round.currentTurnStrokeIds.at(-1)!;
  const nextStrokeIds = match.round.currentTurnStrokeIds.slice(0, -1);
  const nextStrokes = match.round.strokes.filter((stroke) => stroke.id !== strokeIdToRemove);
  assert.deepEqual(
    nextStrokes.map((stroke) => stroke.id),
    ['s1', 's2'],
  );
  assert.deepEqual(nextStrokeIds, ['s2']);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
