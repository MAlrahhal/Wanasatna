/**
 * P9-B.2 drawing hot-path contracts: incremental render + no full-view point ACK.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrawStroke } from '@wanasatna/shared';
import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  appendPointsToStroke,
  cloneDrawStrokes,
  partitionStrokesForProtectedTurn,
  shouldReplaceStrokeSnapshot,
} from '../plugins/draw-guess/drawing-render';

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

function makeStroke(
  id: string,
  pointCount: number,
  tool: DrawStroke['tool'] = 'draw',
): DrawStroke {
  return {
    id,
    tool,
    color: '#111827',
    size: 4,
    points: Array.from({ length: pointCount }, (_, index) => ({ x: index, y: index })),
  };
}

test('logical drawing coordinates stay 800×500', () => {
  assert.equal(DRAWING_CANVAS_WIDTH, 800);
  assert.equal(DRAWING_CANVAS_HEIGHT, 500);
});

test('normal append does not request a full historical redraw', () => {
  const live = [makeStroke('a', 4), makeStroke('b', 8)];
  const incoming = [makeStroke('a', 4), makeStroke('b', 8)];
  assert.equal(shouldReplaceStrokeSnapshot(live, incoming), false);

  const staleSnapshot = [makeStroke('a', 4), makeStroke('b', 2)];
  assert.equal(shouldReplaceStrokeSnapshot(live, staleSnapshot), false);
});

test('structural snapshot does request a full redraw', () => {
  const live = [makeStroke('a', 4)];
  assert.equal(shouldReplaceStrokeSnapshot(live, []), true);
  assert.equal(shouldReplaceStrokeSnapshot(live, [makeStroke('a', 4), makeStroke('b', 1)]), true);
  assert.equal(shouldReplaceStrokeSnapshot([], [makeStroke('a', 12)]), true);
  assert.equal(shouldReplaceStrokeSnapshot(live, [makeStroke('a', 6)]), true);
});

test('client can rebuild the board from an authoritative snapshot', () => {
  const snapshot = [makeStroke('a', 12), makeStroke('b', 7)];
  const rebuilt = cloneDrawStrokes(snapshot);
  assert.equal(shouldReplaceStrokeSnapshot([], rebuilt), true);
  assert.equal(rebuilt[0]?.points.length, 12);
  assert.equal(rebuilt[1]?.points.length, 7);
  rebuilt[0]?.points.push({ x: 99, y: 99 });
  assert.equal(snapshot[0]?.points.length, 12);
});

test('remote append only extends the target stroke', () => {
  const live = [makeStroke('a', 2), makeStroke('b', 1)];
  const appended = appendPointsToStroke(live, 'b', [{ x: 8, y: 9 }]);
  assert.ok(appended);
  assert.equal(appended.fromPoint?.x, 0);
  assert.equal(appended.strokes[0]?.points.length, 2);
  assert.equal(appended.strokes[1]?.points.length, 2);
  assert.equal(appendPointsToStroke(live, 'missing', [{ x: 1, y: 1 }]), null);
});

const canvas = read('plugins/draw-guess/drawing-canvas.tsx');
const drawGuessHook = read('plugins/draw-guess/use-player-view.ts');
const imposterHook = read('plugins/imposter-draw/use-player-view.ts');
const drawGuessScreen = read('plugins/draw-guess/drawing-screen.tsx');
const imposterScreen = read('plugins/imposter-draw/drawing-turns-screen.tsx');

test('canvas pointer movement draws incrementally, not a full historical redraw', () => {
  const moveStart = canvas.indexOf('function handlePointerMove');
  const moveEnd = canvas.indexOf('function endStroke');
  assert.ok(moveStart >= 0 && moveEnd > moveStart);
  const move = canvas.slice(moveStart, moveEnd);
  assert.match(move, /paintSegment/);
  assert.doesNotMatch(move, /renderAllStrokes/);
  const paintStart = canvas.indexOf('function paintSegment');
  assert.ok(paintStart >= 0 && paintStart < moveStart);
  const paint = canvas.slice(paintStart, moveStart);
  assert.match(paint, /drawStrokeSegment/);
  assert.match(paint, /compositeProtectedDrawing/);
  assert.match(
    canvas,
    /renderAllStrokes\(\s*canvas,\s*committedStrokesRef\.current,\s*activeStrokeRef\.current/,
  );
  assert.match(canvas, /POINT_THROTTLE_MS = 40/);
  assert.match(canvas, /onStrokeEnd\?\.\(\{ strokeId: finished\.id \}\)/);
});

for (const [label, hook, pointsEvent, strokeEvent] of [
  ['Draw Guess', drawGuessHook, 'DRAW_GUESS_STROKE_POINTS_EVENT', 'DRAW_GUESS_STROKE_EVENT'],
  ['Imposter Draw', imposterHook, 'IMPOSTER_DRAW_STROKE_POINTS_EVENT', 'IMPOSTER_DRAW_STROKE_EVENT'],
] as const) {
  test(`${label}: point traffic is fire-and-forget and does not replace player view`, () => {
    const pointsHandlerStart = hook.indexOf('const onStrokePoints');
    const pointsHandlerEnd = hook.indexOf(`socket.on(${pointsEvent}`);
    assert.ok(pointsHandlerStart >= 0 && pointsHandlerEnd > pointsHandlerStart);
    const onStrokePoints = hook.slice(pointsHandlerStart, pointsHandlerEnd);
    assert.match(onStrokePoints, /appendRemotePoints/);
    assert.doesNotMatch(onStrokePoints, /setView/);
    assert.doesNotMatch(onStrokePoints, /syncView/);

    assert.match(hook, new RegExp(`getRoomSocket\\(\\)\\.emit\\(${pointsEvent}`));
    assert.doesNotMatch(
      hook,
      new RegExp(`emitPluginWithAck<[^>]*>\\(${pointsEvent}`),
    );
  });

  test(`${label}: stroke end is a marker without point history`, () => {
    assert.match(hook, /const emitStrokeEnd = useCallback/);
    const endStart = hook.indexOf('const emitStrokeEnd');
    const end = hook.slice(endStart, endStart + 450);
    assert.match(end, new RegExp(strokeEvent));
    assert.match(end, /strokeId: payload\.strokeId/);
    assert.doesNotMatch(end, /points:/);
  });
}

test('drawing screens wire stroke end separately from start', () => {
  assert.match(drawGuessScreen, /onStrokeEnd=\{isDrawer \? onEmitStrokeEnd : undefined\}/);
  assert.doesNotMatch(drawGuessScreen, /onStrokeEnd=\{isDrawer \? onEmitStroke : undefined\}/);
  assert.match(imposterScreen, /onStrokeEnd=\{canDraw && onEmitStrokeEnd \? onEmitStrokeEnd : undefined\}/);
  assert.doesNotMatch(imposterScreen, /onStrokeEnd=\{canDraw && onEmitStroke \? onEmitStroke : undefined\}/);
});

test('Imposter Draw protects previous-turn strokes from current-turn erase', () => {
  const turnAHouse = makeStroke('a-house', 8);
  const turnBInk = makeStroke('b-ink', 5);
  const turnBErase = makeStroke('b-erase', 6, 'erase');
  const { frozen, live } = partitionStrokesForProtectedTurn(
    [turnAHouse, turnBInk, turnBErase],
    ['b-ink', 'b-erase'],
    null,
  );

  assert.deepEqual(
    frozen.map((stroke) => stroke.id),
    ['a-house'],
  );
  assert.deepEqual(
    live.map((stroke) => stroke.id),
    ['b-ink', 'b-erase'],
  );
  assert.equal(
    live.some((stroke) => stroke.tool === 'erase'),
    true,
  );
  assert.equal(
    frozen.some((stroke) => stroke.tool === 'erase'),
    false,
  );
});

test('Imposter Draw current-turn erase stays on the live layer', () => {
  const turnBInk = makeStroke('b-ink', 4);
  const turnBErase = makeStroke('b-erase', 3, 'erase');
  const { frozen, live } = partitionStrokesForProtectedTurn(
    [turnBInk, turnBErase],
    ['b-ink', 'b-erase'],
    null,
  );
  assert.equal(frozen.length, 0);
  assert.deepEqual(
    live.map((stroke) => stroke.id),
    ['b-ink', 'b-erase'],
  );
});

test('Imposter Draw undo only removes the latest current-turn stroke', () => {
  const turnAHouse = makeStroke('a-house', 8);
  const turnBInk = makeStroke('b-ink', 5);
  const turnBErase = makeStroke('b-erase', 6, 'erase');
  const remaining = [turnAHouse, turnBInk, turnBErase].filter((stroke) => stroke.id !== 'b-erase');
  const { frozen, live } = partitionStrokesForProtectedTurn(remaining, ['b-ink'], null);
  assert.deepEqual(
    frozen.map((stroke) => stroke.id),
    ['a-house'],
  );
  assert.deepEqual(
    live.map((stroke) => stroke.id),
    ['b-ink'],
  );
});

test('reconnect/full-board snapshot keeps previous-turn ownership', () => {
  const snapshot = [makeStroke('a-house', 12), makeStroke('b-ink', 7), makeStroke('b-erase', 4, 'erase')];
  const rebuilt = cloneDrawStrokes(snapshot);
  assert.equal(shouldReplaceStrokeSnapshot([], rebuilt), true);
  const { frozen, live } = partitionStrokesForProtectedTurn(rebuilt, ['b-ink', 'b-erase'], null);
  assert.equal(frozen[0]?.points.length, 12);
  assert.deepEqual(
    live.map((stroke) => stroke.id),
    ['b-ink', 'b-erase'],
  );
});

test('Imposter Draw wires turn ownership; Draw Guess does not', () => {
  assert.match(imposterScreen, /currentTurnStrokeIds=\{currentTurnStrokeIds\}/);
  assert.match(imposterScreen, /turnId=\{turnId\}/);
  assert.doesNotMatch(drawGuessScreen, /currentTurnStrokeIds/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
