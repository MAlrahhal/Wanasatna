/**
 * P10-B.1 drawing payload/resource abuse hardening.
 * Run: pnpm --filter @wanasatna/server exec tsx tests/drawing-security.unit.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrawStroke } from '@wanasatna/shared';
import {
  countStrokePoints,
  DRAW_GUESS_BOARD_LIMITS,
  DRAWING_COORD_MAX_X,
  DRAWING_COORD_MAX_Y,
  DRAWING_COORD_MIN_X,
  DRAWING_COORD_MIN_Y,
  DRAWING_MAX_POINTS_PER_BATCH,
  DRAWING_MAX_POINTS_PER_STROKE,
  DRAWING_MAX_STROKE_ID_LENGTH,
  IMPOSTER_DRAW_BOARD_LIMITS,
  isValidStrokePoint,
  peekStrokeCommand,
  processStrokeCommand,
  processStrokePointsCommand,
  startAuthoritativeStroke,
  tryAppendAuthoritativeStrokePoints,
  tryStartAuthoritativeStroke,
  type DrawingBoardLimits,
} from '../src/modules/game/runtime/drawing-strokes.js';

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

function makeStroke(
  id: string,
  points: Array<{ x: number; y: number }>,
): DrawStroke {
  return { id, tool: 'draw', color: '#111827', size: 4, points };
}

function nPoints(count: number, point: { x: number; y: number } = { x: 10, y: 10 }) {
  return Array.from({ length: count }, () => ({ ...point }));
}

function legalStart(overrides: Record<string, unknown> = {}) {
  return {
    turnId: 'turn-1',
    strokeId: 'stroke-new',
    tool: 'draw',
    color: '#111827',
    size: 4,
    points: [{ x: 10, y: 10 }],
    ...overrides,
  };
}

function legalPoints(overrides: Record<string, unknown> = {}) {
  return {
    turnId: 'turn-1',
    strokeId: 'stroke-1',
    points: [{ x: 20, y: 20 }],
    ...overrides,
  };
}

function snapshotStrokes(strokes: readonly DrawStroke[]): string {
  return JSON.stringify(strokes);
}

const boards: Array<{ label: string; limits: DrawingBoardLimits }> = [
  { label: 'Draw Guess', limits: DRAW_GUESS_BOARD_LIMITS },
  { label: 'Imposter Draw', limits: IMPOSTER_DRAW_BOARD_LIMITS },
];

for (const { label, limits } of boards) {
  test(`${label}: NaN x/y rejected`, () => {
    assert.equal(isValidStrokePoint({ x: Number.NaN, y: 10 }), false);
    const strokes = [makeStroke('stroke-1', [{ x: 10, y: 10 }])];
    const before = snapshotStrokes(strokes);
    const start = processStrokeCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalStart({ points: [{ x: Number.NaN, y: 10 }] }),
      limits,
    });
    const points = processStrokePointsCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalPoints({ points: [{ x: 10, y: Number.NaN }] }),
      limits,
    });
    assert.equal(start.ok, false);
    assert.equal(points.ok, false);
    assert.equal(snapshotStrokes(strokes), before);
  });

  test(`${label}: Infinity rejected`, () => {
    assert.equal(isValidStrokePoint({ x: Infinity, y: 10 }), false);
    assert.equal(isValidStrokePoint({ x: 10, y: -Infinity }), false);
    const strokes = [makeStroke('stroke-1', [{ x: 10, y: 10 }])];
    const before = snapshotStrokes(strokes);
    const result = processStrokePointsCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalPoints({ points: [{ x: Infinity, y: 10 }] }),
      limits,
    });
    assert.equal(result.ok, false);
    assert.equal(snapshotStrokes(strokes), before);
  });

  test(`${label}: negative/out-of-range coordinate rejected`, () => {
    assert.equal(isValidStrokePoint({ x: DRAWING_COORD_MIN_X - 1, y: 10 }), false);
    assert.equal(isValidStrokePoint({ x: DRAWING_COORD_MAX_X + 1, y: 10 }), false);
    assert.equal(isValidStrokePoint({ x: 10, y: DRAWING_COORD_MIN_Y - 1 }), false);
    assert.equal(isValidStrokePoint({ x: 10, y: DRAWING_COORD_MAX_Y + 1 }), false);
    const strokes = [makeStroke('stroke-1', [{ x: 10, y: 10 }])];
    const before = snapshotStrokes(strokes);
    const result = processStrokePointsCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalPoints({ points: [{ x: -10_000, y: 10 }] }),
      limits,
    });
    assert.equal(result.ok, false);
    assert.equal(snapshotStrokes(strokes), before);
  });

  test(`${label}: oversized point batch rejected`, () => {
    const strokes = [makeStroke('stroke-1', [{ x: 10, y: 10 }])];
    const before = snapshotStrokes(strokes);
    const oversized = nPoints(DRAWING_MAX_POINTS_PER_BATCH + 1);
    assert.equal(peekStrokeCommand(legalStart({ points: oversized })), null);
    const start = processStrokeCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalStart({ points: oversized }),
      limits,
    });
    const points = processStrokePointsCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalPoints({ points: oversized }),
      limits,
    });
    assert.equal(start.ok, false);
    assert.equal(points.ok, false);
    assert.equal(snapshotStrokes(strokes), before);
  });

  test(`${label}: maximum legal batch accepted`, () => {
    const started = processStrokeCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes: [],
      payload: legalStart({ strokeId: 'stroke-1', points: [{ x: 1, y: 1 }] }),
      limits,
    });
    assert.equal(started.ok, true);
    assert.ok(started.ok && started.kind === 'start');
    const appended = processStrokePointsCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes: started.ok && started.kind === 'start' ? started.strokes : [],
      payload: legalPoints({ points: nPoints(DRAWING_MAX_POINTS_PER_BATCH) }),
      limits,
    });
    assert.equal(appended.ok, true);
    assert.equal(
      appended.ok ? appended.strokes[0]?.points.length : 0,
      1 + DRAWING_MAX_POINTS_PER_BATCH,
    );
  });

  test(`${label}: stroke exceeding max points rejected`, () => {
    const existing = makeStroke('stroke-1', nPoints(DRAWING_MAX_POINTS_PER_STROKE));
    const before = snapshotStrokes([existing]);
    const result = tryAppendAuthoritativeStrokePoints(
      [existing],
      'stroke-1',
      [{ x: 11, y: 11 }],
      limits,
    );
    assert.equal(result.ok, false);
    assert.equal(snapshotStrokes([existing]), before);
  });

  test(`${label}: excessive stroke count rejected`, () => {
    const strokes = Array.from({ length: limits.maxStrokes }, (_, index) =>
      makeStroke(`s-${index}`, [{ x: 1, y: 1 }]),
    );
    const before = snapshotStrokes(strokes);
    const result = tryStartAuthoritativeStroke(
      strokes,
      makeStroke('overflow', [{ x: 2, y: 2 }]),
      limits,
    );
    assert.equal(result.ok, false);
    assert.equal(snapshotStrokes(strokes), before);
  });

  test(`${label}: excessive total-board points rejected`, () => {
    const fat = makeStroke('fat', nPoints(limits.maxTotalPoints));
    const before = snapshotStrokes([fat]);
    const start = tryStartAuthoritativeStroke(
      [fat],
      makeStroke('other', [{ x: 3, y: 3 }]),
      limits,
    );
    const append = tryAppendAuthoritativeStrokePoints([fat], 'fat', [{ x: 4, y: 4 }], limits);
    assert.equal(start.ok, false);
    assert.equal(append.ok, false);
    assert.equal(snapshotStrokes([fat]), before);
  });

  test(`${label}: oversized strokeId rejected`, () => {
    const strokes: DrawStroke[] = [];
    const result = processStrokeCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalStart({ strokeId: 's'.repeat(DRAWING_MAX_STROKE_ID_LENGTH + 1) }),
      limits,
    });
    assert.equal(result.ok, false);
    assert.equal(strokes.length, 0);
  });

  test(`${label}: invalid/oversized color and brush rejected`, () => {
    const strokes: DrawStroke[] = [];
    for (const payload of [
      legalStart({ color: 'red' }),
      legalStart({ color: '#000' }),
      legalStart({ color: `#${'11'.repeat(20)}` }),
      legalStart({ size: 32 }),
      legalStart({ size: Number.NaN }),
      legalStart({ size: Infinity }),
      legalStart({ size: -4 }),
      legalStart({ tool: 'laser' }),
    ]) {
      const result = processStrokeCommand({
        playerIsCurrentDrawer: true,
        currentTurnId: 'turn-1',
        strokes,
        payload,
        limits,
      });
      assert.equal(result.ok, false, `should reject ${JSON.stringify(payload)}`);
    }
    assert.equal(strokes.length, 0);

    const ok = processStrokeCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalStart({ color: '#FFFFFF', size: 16, tool: 'erase' }),
      limits,
    });
    assert.equal(ok.ok, true);
  });

  test(`${label}: unauthorized drawer with malicious payload does not mutate`, () => {
    const strokes = [makeStroke('stroke-1', [{ x: 10, y: 10 }])];
    const before = snapshotStrokes(strokes);
    const start = processStrokeCommand({
      playerIsCurrentDrawer: false,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalStart({ points: nPoints(DRAWING_MAX_POINTS_PER_BATCH) }),
      limits,
    });
    const points = processStrokePointsCommand({
      playerIsCurrentDrawer: false,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalPoints({ points: nPoints(DRAWING_MAX_POINTS_PER_BATCH) }),
      limits,
    });
    assert.equal(start.ok, false);
    assert.ok(!start.ok && start.error === 'unauthorized');
    assert.equal(points.ok, false);
    assert.ok(!points.ok && points.error === 'unauthorized');
    assert.equal(snapshotStrokes(strokes), before);
  });

  test(`${label}: stale turn with malicious payload does not mutate`, () => {
    const strokes = [makeStroke('stroke-1', [{ x: 10, y: 10 }])];
    const before = snapshotStrokes(strokes);
    const start = processStrokeCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalStart({
        turnId: 'stale-turn',
        points: [{ x: Number.NaN, y: Infinity }],
      }),
      limits,
    });
    const points = processStrokePointsCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes,
      payload: legalPoints({ turnId: 'stale-turn', points: nPoints(DRAWING_MAX_POINTS_PER_BATCH) }),
      limits,
    });
    assert.equal(start.ok, false);
    assert.ok(!start.ok && start.error === 'stale-turn');
    assert.equal(points.ok, false);
    assert.ok(!points.ok && points.error === 'stale-turn');
    assert.equal(snapshotStrokes(strokes), before);
  });

  test(`${label}: valid normal drawing still works`, () => {
    const started = processStrokeCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes: [],
      payload: legalStart({ strokeId: 'stroke-1', points: [{ x: 0, y: 0 }] }),
      limits,
    });
    assert.equal(started.ok, true);
    assert.ok(started.ok && started.kind === 'start');
    const appended = processStrokePointsCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes: started.ok && started.kind === 'start' ? started.strokes : [],
      payload: legalPoints({ points: [{ x: 800, y: 500 }] }),
      limits,
    });
    assert.equal(appended.ok, true);
    const ended = processStrokeCommand({
      playerIsCurrentDrawer: true,
      currentTurnId: 'turn-1',
      strokes: appended.ok ? appended.strokes : [],
      payload: { turnId: 'turn-1', strokeId: 'stroke-1' },
      limits,
    });
    assert.equal(ended.ok, true);
    assert.ok(ended.ok && ended.kind === 'end');
    assert.equal(appended.ok ? appended.strokes[0]?.points.length : 0, 2);
  });
}

test('canvas-edge coordinates and honest slack are accepted', () => {
  assert.equal(isValidStrokePoint({ x: 0, y: 0 }), true);
  assert.equal(isValidStrokePoint({ x: 800, y: 500 }), true);
  assert.equal(isValidStrokePoint({ x: DRAWING_COORD_MIN_X, y: DRAWING_COORD_MIN_Y }), true);
  assert.equal(isValidStrokePoint({ x: DRAWING_COORD_MAX_X, y: DRAWING_COORD_MAX_Y }), true);
});

test('Imposter previous-turn strokes cannot receive point appends', () => {
  const strokes = [
    makeStroke('prev', [{ x: 1, y: 1 }]),
    makeStroke('live', [{ x: 2, y: 2 }]),
  ];
  const before = snapshotStrokes(strokes);
  const result = processStrokePointsCommand({
    playerIsCurrentDrawer: true,
    currentTurnId: 'turn-1',
    strokes,
    payload: legalPoints({ strokeId: 'prev', points: [{ x: 3, y: 3 }] }),
    limits: IMPOSTER_DRAW_BOARD_LIMITS,
    allowedStrokeIds: ['live'],
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.error === 'protected-stroke');
  assert.equal(snapshotStrokes(strokes), before);
});

test('reconnect snapshot is not truncated: ingest limits apply only to new input', () => {
  const history = Array.from({ length: 12 }, (_, index) =>
    makeStroke(`hist-${index}`, nPoints(8, { x: index, y: index })),
  );
  assert.equal(history.length, 12);
  assert.equal(countStrokePoints(history), 96);
  const started = startAuthoritativeStroke(history, makeStroke('hist-0', [{ x: 99, y: 99 }]));
  assert.equal(started.created, false);
  assert.equal(started.strokes.length, 12);
  assert.equal(started.strokes[0]?.points.length, 8);
  const next = tryStartAuthoritativeStroke(
    history,
    makeStroke('hist-new', [{ x: 5, y: 5 }]),
    DRAW_GUESS_BOARD_LIMITS,
  );
  assert.equal(next.ok, true);
  assert.equal(next.ok ? next.strokes.length : 0, 13);
});

const drawGuessHandlers = read('src/modules/game/plugins/draw-guess/socket.handlers.ts');
const imposterHandlers = read('src/modules/game/plugins/imposter-draw/socket.handlers.ts');

for (const [label, source, strokeEvent, pointsEvent] of [
  ['Draw Guess', drawGuessHandlers, 'DRAW_GUESS_STROKE_EVENT', 'DRAW_GUESS_STROKE_POINTS_EVENT'],
  [
    'Imposter Draw',
    imposterHandlers,
    'IMPOSTER_DRAW_STROKE_EVENT',
    'IMPOSTER_DRAW_STROKE_POINTS_EVENT',
  ],
] as const) {
  test(`${label}: identity/auth run before stroke ingest`, () => {
    const stroke = handlerBlock(source, strokeEvent);
    const points = handlerBlock(source, pointsEvent);
    assert.ok(stroke.indexOf('notParticipantError') < stroke.indexOf('processStrokeCommand'));
    assert.ok(points.indexOf('notParticipantError') < points.indexOf('processStrokePointsCommand'));
  });

  test(`${label}: rejected ingest cannot reach room broadcast`, () => {
    const stroke = handlerBlock(source, strokeEvent);
    const points = handlerBlock(source, pointsEvent);
    assert.ok(stroke.indexOf('if (!result.ok)') < stroke.indexOf('broadcastCanvasUpdated'));
    assert.ok(points.indexOf('if (!result.ok)') < points.indexOf('.emit('));
    assert.doesNotMatch(points, /broadcastCanvasUpdated/);
    assert.match(points, /points: result\.points/);
  });
}

test('Imposter start still records current-turn stroke ids only for new strokes', () => {
  const stroke = handlerBlock(imposterHandlers, 'IMPOSTER_DRAW_STROKE_EVENT');
  assert.match(stroke, /currentTurnStrokeIds\.includes\(result\.strokeId\)/);
  assert.match(stroke, /currentTurnStrokeIds: nextTurnStrokeIds/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
