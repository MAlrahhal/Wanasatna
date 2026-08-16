/**
 * P9-B.2 drawing hot-path contracts for Draw Guess + Imposter Draw.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/drawing-performance.unit.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  DrawGuessMatchState,
  DrawGuessRoundState,
  DrawStroke,
  GameShellState,
  ImposterDrawMatchState,
  ImposterDrawRoundState,
} from '@wanasatna/shared';
import {
  DRAW_GUESS_GAME_ID,
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_TURN_SECONDS,
} from '@wanasatna/shared';
import {
  appendAuthoritativeStrokePoints,
  hasAuthoritativeStroke,
  startAuthoritativeStroke,
} from '../src/modules/game/runtime/drawing-strokes.js';
import {
  buildDrawGuessPlayerView,
  withRound as withDrawGuessRound,
} from '../src/modules/game/plugins/draw-guess/state.js';
import {
  buildImposterDrawPlayerView,
  withRound as withImposterDrawRound,
} from '../src/modules/game/plugins/imposter-draw/state.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

function handlerBlock(source: string, eventConst: string): string {
  const needle = `socket.on(${eventConst}`;
  const start = source.indexOf(needle);
  assert.ok(start >= 0, `missing handler ${eventConst}`);
  const next = source.indexOf('socket.on(', start + needle.length);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

function makeStroke(id: string, points: Array<{ x: number; y: number }>): DrawStroke {
  return { id, tool: 'draw', color: '#111827', size: 4, points };
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

function makeShell(gameId: typeof DRAW_GUESS_GAME_ID | typeof IMPOSTER_DRAW_GAME_ID): GameShellState {
  const players = makePlayers(3);
  return {
    shellId: 'shell-1',
    roomId: 'room-1',
    gameId,
    hostPlayerId: 'p1',
    phase: 'PLAYING',
    countdownRemainingSeconds: null,
    gameTimerRemainingSeconds: null,
    players: players.map((player) => ({ ...player, isHost: player.id === 'p1' })),
    matchParticipantIds: players.map((player) => player.id),
    readyPlayerIds: players.map((player) => player.id),
    countdownSeconds: null,
    gameTimerSeconds: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

function accumulateStroke(id = 'stroke-1'): DrawStroke[] {
  const started = startAuthoritativeStroke([], makeStroke(id, [{ x: 1, y: 1 }]));
  assert.equal(started.created, true);
  const appended = appendAuthoritativeStrokePoints(started.strokes, id, [
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ]);
  assert.ok(appended);
  return appended;
}

test('streamed points accumulate and END must not replace history', () => {
  const strokes = accumulateStroke('stroke-1');
  assert.equal(strokes[0]?.points.length, 3);
  assert.equal(hasAuthoritativeStroke(strokes, 'stroke-1'), true);

  const replay = startAuthoritativeStroke(strokes, makeStroke('stroke-1', [{ x: 99, y: 99 }]));
  assert.equal(replay.created, false);
  assert.deepEqual(replay.strokes[0]?.points, [
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ]);
});

test('clear/reset removes authoritative strokes', () => {
  const strokes = accumulateStroke('stroke-1');
  assert.equal(strokes.length, 1);
  const cleared: DrawStroke[] = [];
  assert.equal(hasAuthoritativeStroke(cleared, 'stroke-1'), false);
  assert.equal(appendAuthoritativeStrokePoints(cleared, 'stroke-1', [{ x: 4, y: 4 }]), null);
});

test('Draw Guess SYNC/player view contains complete current drawing', () => {
  const players = makePlayers(3);
  const strokes = accumulateStroke('stroke-1');
  const round: DrawGuessRoundState = {
    turnId: 'turn-live',
    word: 'أسد',
    wordCategoryId: 'animals',
    drawerPlayerId: 'p1',
    gamePhase: 'drawing',
    phaseRemainingSeconds: 60,
    deadlineAtMs: Date.now() + 60_000,
    drawingDurationSeconds: 60,
    strokes,
    correctGuesserPlayerId: null,
    guessedCorrectly: false,
  };
  const match: DrawGuessMatchState = {
    playerIds: players.map((player) => player.id),
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    drawerMode: 'random',
    fixedDrawerPlayerId: null,
    usedWordTexts: ['أسد'],
    round,
  };
  const view = buildDrawGuessPlayerView(match, 'p2', makeShell(DRAW_GUESS_GAME_ID));
  assert.equal(view.strokes.length, 1);
  assert.equal(view.strokes[0]?.points.length, 3);
  assert.deepEqual(view.strokes[0]?.points.at(-1), { x: 3, y: 3 });

  const cleared = withDrawGuessRound(match, { ...match.round, strokes: [] });
  assert.equal(buildDrawGuessPlayerView(cleared, 'p2', makeShell(DRAW_GUESS_GAME_ID)).strokes.length, 0);
});

test('Imposter Draw SYNC/player view contains complete current drawing', () => {
  const players = makePlayers(3);
  const strokes = accumulateStroke('stroke-1');
  const round: ImposterDrawRoundState = {
    turnId: 'turn-live',
    imageId: 'img-1',
    imageLabel: 'قطة',
    imageUrl: 'data:image/svg+xml,cat',
    imageCategoryId: 'animals',
    impostorPlayerId: 'p2',
    drawingOrder: ['p1', 'p2', 'p3'],
    currentDrawerIndex: 0,
    currentTurnStrokeIds: ['stroke-1'],
    turnDurationSeconds: IMPOSTER_DRAW_TURN_SECONDS,
    gamePhase: 'drawing-turns',
    phaseRemainingSeconds: IMPOSTER_DRAW_TURN_SECONDS,
    deadlineAtMs: Date.now() + IMPOSTER_DRAW_TURN_SECONDS * 1000,
    strokes,
    roleUnderstoodPlayerIds: ['p1', 'p2', 'p3'],
    votes: {},
    submittedVoterIds: [],
    impostorVotedOut: null,
    impostorGuessOptions: [],
    selectedImageGuess: null,
    impostorGuessedCorrectly: null,
    revealDurationSeconds: 10,
    guessDurationSeconds: 30,
  };
  const match: ImposterDrawMatchState = {
    playerIds: players.map((player) => player.id),
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    currentRound: 1,
    totalRounds: 3,
    scores: { p1: 0, p2: 0, p3: 0 },
    matchStatus: 'in-progress',
    usedImageTexts: ['قطة'],
    previousImpostorPlayerId: null,
    round,
  };
  const view = buildImposterDrawPlayerView(match, 'p3', makeShell(IMPOSTER_DRAW_GAME_ID));
  assert.equal(view.strokes.length, 1);
  assert.equal(view.strokes[0]?.points.length, 3);
  assert.equal(view.referenceImage, null);
  assert.deepEqual(view.currentTurnStrokeIds, ['stroke-1']);

  const cleared = withImposterDrawRound(match, { ...match.round, strokes: [], currentTurnStrokeIds: [] });
  assert.equal(
    buildImposterDrawPlayerView(cleared, 'p3', makeShell(IMPOSTER_DRAW_GAME_ID)).strokes.length,
    0,
  );
});

const drawGuessHandlers = read('src/modules/game/plugins/draw-guess/socket.handlers.ts');
const imposterHandlers = read('src/modules/game/plugins/imposter-draw/socket.handlers.ts');

for (const [label, source, pointsEvent, syncEvent, viewBuilder] of [
  [
    'Draw Guess',
    drawGuessHandlers,
    'DRAW_GUESS_STROKE_POINTS_EVENT',
    'DRAW_GUESS_SYNC_EVENT',
    'buildDrawGuessPlayerView',
  ],
  [
    'Imposter Draw',
    imposterHandlers,
    'IMPOSTER_DRAW_STROKE_POINTS_EVENT',
    'IMPOSTER_DRAW_SYNC_EVENT',
    'buildImposterDrawPlayerView',
  ],
] as const) {
  test(`${label}: point batch handler does not build player view or SYNC`, () => {
    const points = handlerBlock(source, pointsEvent);
    assert.match(points, /processStrokePointsCommand/);
    assert.match(
      points,
      new RegExp(
        `socket\\.to\\(getRoomChannel\\(roomId!\\)\\)\\.emit\\(${pointsEvent}, \\{\\s*turnId: result\\.turnId,\\s*strokeId: result\\.strokeId,\\s*points: result\\.points,\\s*\\}\\)`,
      ),
    );
    assert.match(points, /data: \{ ok: true \}/);
    assert.doesNotMatch(points, new RegExp(viewBuilder));
    assert.doesNotMatch(points, new RegExp(syncEvent));
    assert.doesNotMatch(points, /io\.to\(/);
    assert.doesNotMatch(points, /broadcastCanvasUpdated/);
  });

  test(`${label}: stroke start/end ACK is lightweight and end does not replace points`, () => {
    const stroke = handlerBlock(source, label === 'Draw Guess' ? 'DRAW_GUESS_STROKE_EVENT' : 'IMPOSTER_DRAW_STROKE_EVENT');
    assert.match(stroke, /processStrokeCommand/);
    assert.match(stroke, /kind === 'end'/);
    assert.match(stroke, /start-noop/);
    assert.match(stroke, /data: \{ ok: true \}/);
    assert.doesNotMatch(stroke, new RegExp(viewBuilder));

    const endStart = stroke.indexOf("kind === 'end'");
    const mutateStart = stroke.indexOf('strokes: result.strokes');
    assert.ok(endStart >= 0 && mutateStart > endStart);
    const endBlock = stroke.slice(endStart, mutateStart);
    assert.doesNotMatch(endBlock, /points:/);
    assert.match(endBlock, /data: \{ ok: true \}/);
    assert.doesNotMatch(endBlock, /broadcastCanvasUpdated/);
  });

  test(`${label}: SYNC still serializes the authoritative drawing snapshot`, () => {
    const sync = handlerBlock(source, syncEvent);
    assert.match(sync, new RegExp(viewBuilder));
  });

  test(`${label}: stale turn drawing input is rejected`, () => {
    assert.match(source, /processStrokeCommand/);
    assert.match(source, /processStrokePointsCommand/);
    assert.match(source, /currentTurnId: match\.round\.turnId/);
  });
}

test('Imposter Draw point batches require current-turn stroke ownership', () => {
  const points = handlerBlock(imposterHandlers, 'IMPOSTER_DRAW_STROKE_POINTS_EVENT');
  assert.match(points, /allowedStrokeIds: match\.round\.currentTurnStrokeIds/);
});

test('Imposter Draw canvas-updated broadcasts current-turn stroke ids', () => {
  assert.match(
    imposterHandlers,
    /emit\(IMPOSTER_DRAW_CANVAS_UPDATED_EVENT, \{\s*turnId,\s*strokes,\s*currentTurnStrokeIds,\s*\}\)/,
  );
});

test('Draw Guess clear empties authoritative strokes', () => {
  const clear = handlerBlock(drawGuessHandlers, 'DRAW_GUESS_CLEAR_CANVAS_EVENT');
  assert.match(clear, /strokes: \[\]/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
