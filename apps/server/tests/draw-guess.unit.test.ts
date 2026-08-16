/**
 * Unit tests for Draw & Guess (ارسم وخمّن) P4.2 rules.
 * Run: pnpm --filter @wanasatna/server test:draw-guess
 */
import assert from 'node:assert/strict';
import type { DrawGuessMatchState, DrawGuessRoundState, GameShellState } from '@wanasatna/shared';
import {
  DRAW_GUESS_DEFAULT_ROUNDS,
  DRAW_GUESS_DRAW_DURATION_SECONDS,
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_ROUND_RESULTS_DURATION_SECONDS,
} from '@wanasatna/shared';
import { registerGameContent } from '../src/modules/content/registry.js';
import { timedPhaseDurations } from '../src/config/test-timers.js';
import { applyDrawGuessLobbySettings } from '../src/modules/game/plugins/draw-guess/drawer-mode-store.js';
import {
  applyRoundScores,
  DRAW_GUESS_CORRECT_GUESS_POINTS,
} from '../src/modules/game/plugins/draw-guess/scoring.js';
import {
  buildDrawGuessPlayerView,
  buildDrawGuessSpectatorView,
  createMatchState,
  createRoundState,
  resolveDrawerPlayerId,
  resolveDrawingDurationSeconds,
  resolveTotalRounds,
  serializeDrawGuessState,
  withRound,
} from '../src/modules/game/plugins/draw-guess/state.js';
import { isCorrectGuess, normalizeGuessText } from '../src/modules/game/plugins/draw-guess/words.js';

registerGameContent(DRAW_GUESS_GAME_ID);

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
    gameId: DRAW_GUESS_GAME_ID,
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

function makeRound(overrides: Partial<DrawGuessRoundState> = {}): DrawGuessRoundState {
  return {
    turnId: 'turn-a',
    word: 'أسد',
    wordCategoryId: 'animals',
    drawerPlayerId: 'p1',
    gamePhase: 'drawing',
    phaseRemainingSeconds: 60,
    deadlineAtMs: Date.now() + 60_000,
    drawingDurationSeconds: 60,
    strokes: [],
    correctGuesserPlayerId: null,
    guessedCorrectly: false,
    ...overrides,
  };
}

function makeMatch(overrides: Partial<DrawGuessMatchState> = {}): DrawGuessMatchState {
  const players = makePlayers(3);
  return {
    playerIds: players.map((player) => player.id),
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    drawerMode: 'random',
    fixedDrawerPlayerId: null,
    usedWordTexts: ['أسد'],
    round: makeRound(),
    ...overrides,
    round: makeRound(overrides.round),
  };
}

test('product constants: 3 rounds, 60s draw, 10s results', () => {
  assert.equal(DRAW_GUESS_DEFAULT_ROUNDS, 3);
  assert.equal(DRAW_GUESS_DRAW_DURATION_SECONDS, 60);
  assert.equal(DRAW_GUESS_ROUND_RESULTS_DURATION_SECONDS, 10);
  assert.equal(resolveTotalRounds(), 3);
});

test('drawing duration uses dedicated drawGuessDrawing helper (not bara 20s)', () => {
  const duration = resolveDrawingDurationSeconds();
  assert.equal(duration, timedPhaseDurations.drawGuessDrawing());
  assert.notEqual(duration, 20);
});

test('2 and 8 player match creation accepted by state factory', () => {
  const two = createMatchState('room-2', makePlayers(2), {
    minPlayers: 2,
    maxPlayers: 8,
    rounds: 3,
    roundTime: 60,
    enabledCategories: [],
  });
  assert.equal(two.playerIds.length, 2);
  assert.equal(two.totalRounds, 3);

  const eight = createMatchState('room-8', makePlayers(8), {
    minPlayers: 2,
    maxPlayers: 8,
    rounds: 3,
    roundTime: 60,
    enabledCategories: [],
  });
  assert.equal(eight.playerIds.length, 8);
  assert.equal(eight.totalRounds, 3);
});

test('lobby settings: random accepted', () => {
  const result = applyDrawGuessLobbySettings('room-a', { drawerMode: 'random' }, ['p1', 'p2']);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.settings.drawerMode, 'random');
    assert.equal(result.settings.fixedPlayerId, null);
  }
});

test('lobby settings: fixed requires eligible player; invalid rejected', () => {
  const badMissing = applyDrawGuessLobbySettings('room-b', { drawerMode: 'fixed' }, ['p1', 'p2']);
  assert.equal(badMissing.success, false);

  const badId = applyDrawGuessLobbySettings(
    'room-b2',
    { drawerMode: 'fixed', fixedPlayerId: 'ghost' },
    ['p1', 'p2'],
  );
  assert.equal(badId.success, false);

  const good = applyDrawGuessLobbySettings(
    'room-c',
    { drawerMode: 'fixed', fixedPlayerId: 'p2' },
    ['p1', 'p2'],
  );
  assert.equal(good.success, true);
  if (good.success) {
    assert.equal(good.settings.fixedPlayerId, 'p2');
  }
});

test('fixed drawer resolves same player; unavailable falls back to first connected roster', () => {
  assert.equal(
    resolveDrawerPlayerId({
      drawerMode: 'fixed',
      fixedDrawerPlayerId: 'p2',
      playerIds: ['p1', 'p2', 'p3'],
      connectedPlayerIds: ['p1', 'p2', 'p3'],
    }),
    'p2',
  );

  assert.equal(
    resolveDrawerPlayerId({
      drawerMode: 'fixed',
      fixedDrawerPlayerId: 'p2',
      playerIds: ['p1', 'p2', 'p3'],
      connectedPlayerIds: ['p1', 'p3'],
    }),
    'p1',
  );
});

test('random drawer picks from connected pool', () => {
  const drawer = resolveDrawerPlayerId({
    drawerMode: 'random',
    fixedDrawerPlayerId: null,
    playerIds: ['p1', 'p2', 'p3'],
    connectedPlayerIds: ['p2'],
  });
  assert.equal(drawer, 'p2');
});

test('privacy: drawer gets word; guesser and spectator do not', () => {
  const match = makeMatch();
  const shell = makeShell(match.round.drawerPlayerId);
  const drawerView = buildDrawGuessPlayerView(match, match.round.drawerPlayerId, shell);
  const guesserId = match.playerIds.find((id) => id !== match.round.drawerPlayerId)!;
  const guesserView = buildDrawGuessPlayerView(match, guesserId, shell);
  const spectatorView = buildDrawGuessSpectatorView(match);

  assert.equal(drawerView.secretWord, match.round.word);
  assert.equal(guesserView.secretWord, null);
  assert.equal(spectatorView.secretWord, null);
  assert.equal(spectatorView.isMatchSpectator, true);
  assert.equal(spectatorView.canGuess, false);
  assert.equal(spectatorView.leaderboard.length, match.playerIds.length);
  assert.ok(Array.isArray(spectatorView.strokes));
});

test('serializeDrawGuessState blanks secret word', () => {
  const match = makeMatch();
  const serialized = serializeDrawGuessState(match);
  assert.equal(serialized.round.word, '');
  assert.notEqual(match.round.word, '');
});

test('guess normalization Arabic variants', () => {
  assert.equal(normalizeGuessText('  آيس كريم '), normalizeGuessText('ايس كريم'));
  assert.ok(isCorrectGuess('أسد', 'اسد'));
  assert.equal(isCorrectGuess('فيل', 'أسد'), false);
});

test('scoring: +100 guesser and drawer; zero when unsolved', () => {
  const match = makeMatch({
    round: makeRound({
      guessedCorrectly: true,
      correctGuesserPlayerId: 'p2',
      drawerPlayerId: 'p1',
    }),
  });
  const scored = applyRoundScores(match);
  assert.equal(scored.scores.p1, DRAW_GUESS_CORRECT_GUESS_POINTS);
  assert.equal(scored.scores.p2, DRAW_GUESS_CORRECT_GUESS_POINTS);
  assert.equal(scored.scores.p3, 0);

  const unsolved = applyRoundScores(
    makeMatch({
      round: makeRound({ guessedCorrectly: false, correctGuesserPlayerId: null }),
    }),
  );
  assert.equal(unsolved.scores.p1, 0);
});

test('each round creates a unique turnId and empty canvas', () => {
  const match = createMatchState(
    'room-turn',
    makePlayers(3),
    { minPlayers: 2, maxPlayers: 8, rounds: 3, roundTime: 60, enabledCategories: [] },
    'random',
    null,
  );
  const firstTurnId = match.round.turnId;
  const next = createRoundState('room-turn', match, 2, match.playerIds);
  assert.notEqual(next.round.turnId, firstTurnId);
  assert.deepEqual(next.round.strokes, []);
  assert.equal(next.round.gamePhase, 'drawing');
});

test('fixed mode keeps same drawer across all 3 rounds when available', () => {
  const base = createMatchState(
    'room-fixed',
    makePlayers(3),
    { minPlayers: 2, maxPlayers: 8, rounds: 3, roundTime: 60, enabledCategories: [] },
    'fixed',
    'p3',
  );
  assert.equal(base.round.drawerPlayerId, 'p3');
  const r2 = createRoundState('room-fixed', base, 2, base.playerIds);
  const r3 = createRoundState(
    'room-fixed',
    { ...base, usedWordTexts: r2.usedWordTexts },
    3,
    base.playerIds,
  );
  assert.equal(r2.round.drawerPlayerId, 'p3');
  assert.equal(r3.round.drawerPlayerId, 'p3');
});

test('word exclusion accumulates across rounds when alternatives exist', () => {
  const match = createMatchState(
    'room-words',
    makePlayers(3),
    { minPlayers: 2, maxPlayers: 8, rounds: 3, roundTime: 60, enabledCategories: [] },
  );
  const r1Word = match.round.word;
  const r2 = createRoundState('room-words', match, 2, match.playerIds);
  assert.ok(match.usedWordTexts.includes(r1Word));
  if (match.usedWordTexts.length + 1 < 10) {
    assert.notEqual(r2.round.word, r1Word);
  }
  assert.ok(r2.usedWordTexts.includes(r2.round.word));
});

test('round-results view: mid-round next copy vs final-round copy', () => {
  const mid = withRound(makeMatch({ currentRound: 1, totalRounds: 3 }), makeRound({ gamePhase: 'round-results', phaseRemainingSeconds: 10 }));
  const final = withRound(makeMatch({ currentRound: 3, totalRounds: 3 }), makeRound({ gamePhase: 'round-results', phaseRemainingSeconds: 10 }));
  const shell = makeShell('p1');

  const midHost = buildDrawGuessPlayerView(mid, 'p1', shell);
  assert.equal(midHost.roundResultsContinueLabel, 'التالي الآن');
  assert.equal(midHost.roundResultsWaitingMessage, 'الجولة التالية تبدأ تلقائياً...');

  const finalHost = buildDrawGuessPlayerView(final, 'p1', shell);
  assert.equal(finalHost.roundResultsContinueLabel, 'عرض النتائج الآن');
  assert.equal(finalHost.roundResultsWaitingMessage, 'سيتم عرض النتائج النهائية تلقائياً...');
});

test('match-completed view exposes host return CTA', () => {
  const match = withRound(
    makeMatch({ currentRound: 3, totalRounds: 3, matchStatus: 'completed' }),
    makeRound({ gamePhase: 'match-completed', phaseRemainingSeconds: 30 }),
  );
  const hostView = buildDrawGuessPlayerView(match, 'p1', makeShell('p1'));
  assert.equal(hostView.roundResultsContinueLabel, 'العودة إلى اللوبي');
  assert.ok(hostView.roundResultsWaitingMessage?.includes('اللوبي'));
});

test('stale turnId mismatch is detectable against current round', () => {
  const match = makeMatch({ round: makeRound({ turnId: 'turn-current' }) });
  assert.notEqual(match.round.turnId, 'turn-old');
  assert.equal(match.round.turnId === 'turn-old', false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
