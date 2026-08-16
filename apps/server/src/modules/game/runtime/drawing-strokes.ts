import type { DrawStroke, DrawStrokePoint, DrawGuessTool } from '@wanasatna/shared';

/** Logical canvas from the client (`drawing-render.ts`). */
export const DRAWING_CANVAS_WIDTH = 800;
export const DRAWING_CANVAS_HEIGHT = 500;
/**
 * Pointer-capture mapping can emit a few logical px past the canvas edge.
 * Large enough for honest slip/FP; far below malicious 1e9-style coords.
 */
export const DRAWING_COORD_SLACK = 64;
export const DRAWING_COORD_MIN_X = -DRAWING_COORD_SLACK;
export const DRAWING_COORD_MAX_X = DRAWING_CANVAS_WIDTH + DRAWING_COORD_SLACK;
export const DRAWING_COORD_MIN_Y = -DRAWING_COORD_SLACK;
export const DRAWING_COORD_MAX_Y = DRAWING_CANVAS_HEIGHT + DRAWING_COORD_SLACK;

/**
 * Honest client flushes ~every 40ms (`POINT_THROTTLE_MS`). Pointers are typically
 * 60–125 Hz (≤5 points/batch), worst ~250 Hz (≤10). 64 leaves scribble headroom.
 */
export const DRAWING_MAX_POINTS_PER_BATCH = 64;
/**
 * One continuous 60s stroke at ~250 Hz ≈ 15k points. 16k keeps long scribbles.
 */
export const DRAWING_MAX_POINTS_PER_STROKE = 16_000;
export const DRAWING_MAX_STROKE_ID_LENGTH = 64;
export const DRAWING_MAX_TURN_ID_LENGTH = 80;
export const DRAWING_ALLOWED_BRUSH_SIZES = [4, 8, 16] as const;
const DRAWING_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export type DrawingBoardLimits = {
  maxStrokes: number;
  maxTotalPoints: number;
};

/** Draw Guess: one 60s turn. ~8 taps/s → ~480 strokes; 60s×250 Hz → 15k points. */
export const DRAW_GUESS_BOARD_LIMITS: DrawingBoardLimits = {
  maxStrokes: 800,
  maxTotalPoints: 24_000,
};

/**
 * Imposter Draw: cumulative board, 8×15s turns. Cap the whole board, including
 * previous-turn protected strokes — not only the current drawer’s live layer.
 */
export const IMPOSTER_DRAW_BOARD_LIMITS: DrawingBoardLimits = {
  maxStrokes: 2_000,
  maxTotalPoints: 48_000,
};

export type PeekedStrokeStart = {
  kind: 'start';
  turnId: string;
  strokeId: string;
  tool: DrawGuessTool;
  color: string;
  size: number;
  points: unknown[];
};

export type PeekedStrokeEnd = {
  kind: 'end';
  turnId: string;
  strokeId: string;
};

export type PeekedStrokePoints = {
  turnId: string;
  strokeId: string;
  points: unknown[];
};

export type ProcessStrokeResult =
  | { ok: false; error: 'invalid-payload' | 'unauthorized' | 'stale-turn' | 'missing-stroke' | 'limit' }
  | { ok: true; kind: 'end' }
  | { ok: true; kind: 'start-noop' }
  | { ok: true; kind: 'start'; strokes: DrawStroke[]; strokeId: string };

export type ProcessStrokePointsResult =
  | {
      ok: false;
      error: 'invalid-payload' | 'unauthorized' | 'stale-turn' | 'missing-stroke' | 'limit' | 'protected-stroke';
    }
  | { ok: true; strokes: DrawStroke[]; points: DrawStrokePoint[]; turnId: string; strokeId: string };

export function cloneDrawStrokes(strokes: readonly DrawStroke[]): DrawStroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: [...stroke.points],
  }));
}

export function countStrokePoints(strokes: readonly DrawStroke[]): number {
  let total = 0;
  for (const stroke of strokes) {
    total += stroke.points.length;
  }
  return total;
}

export function isValidBrushSize(value: unknown): value is number {
  return value === 4 || value === 8 || value === 16;
}

export function isValidStrokeColor(value: unknown): value is string {
  return typeof value === 'string' && DRAWING_COLOR_PATTERN.test(value);
}

export function isValidStrokePoint(value: unknown): value is DrawStrokePoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const point = value as { x?: unknown; y?: unknown };
  return (
    typeof point.x === 'number' &&
    typeof point.y === 'number' &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= DRAWING_COORD_MIN_X &&
    point.x <= DRAWING_COORD_MAX_X &&
    point.y >= DRAWING_COORD_MIN_Y &&
    point.y <= DRAWING_COORD_MAX_Y
  );
}

export function parseValidatedStrokePoints(points: unknown[]): DrawStrokePoint[] | null {
  if (points.length === 0 || points.length > DRAWING_MAX_POINTS_PER_BATCH) {
    return null;
  }

  const parsed: DrawStrokePoint[] = [];

  for (const point of points) {
    if (!isValidStrokePoint(point)) {
      return null;
    }

    parsed.push({ x: point.x, y: point.y });
  }

  return parsed;
}

export function peekStrokeCommand(payload: unknown): PeekedStrokeStart | PeekedStrokeEnd | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as {
    turnId?: unknown;
    strokeId?: unknown;
    tool?: unknown;
    color?: unknown;
    size?: unknown;
    points?: unknown;
  };

  if (
    typeof data.turnId !== 'string' ||
    data.turnId.length === 0 ||
    data.turnId.length > DRAWING_MAX_TURN_ID_LENGTH ||
    typeof data.strokeId !== 'string' ||
    data.strokeId.length === 0 ||
    data.strokeId.length > DRAWING_MAX_STROKE_ID_LENGTH
  ) {
    return null;
  }

  if (!Array.isArray(data.points) || data.points.length === 0) {
    return { kind: 'end', turnId: data.turnId, strokeId: data.strokeId };
  }

  if (data.points.length > DRAWING_MAX_POINTS_PER_BATCH) {
    return null;
  }

  if (
    (data.tool !== 'draw' && data.tool !== 'erase') ||
    !isValidStrokeColor(data.color) ||
    !isValidBrushSize(data.size)
  ) {
    return null;
  }

  return {
    kind: 'start',
    turnId: data.turnId,
    strokeId: data.strokeId,
    tool: data.tool,
    color: data.color,
    size: data.size,
    points: data.points,
  };
}

export function peekStrokePointsCommand(payload: unknown): PeekedStrokePoints | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as { turnId?: unknown; strokeId?: unknown; points?: unknown };

  if (
    typeof data.turnId !== 'string' ||
    data.turnId.length === 0 ||
    data.turnId.length > DRAWING_MAX_TURN_ID_LENGTH ||
    typeof data.strokeId !== 'string' ||
    data.strokeId.length === 0 ||
    data.strokeId.length > DRAWING_MAX_STROKE_ID_LENGTH ||
    !Array.isArray(data.points) ||
    data.points.length === 0 ||
    data.points.length > DRAWING_MAX_POINTS_PER_BATCH
  ) {
    return null;
  }

  return {
    turnId: data.turnId,
    strokeId: data.strokeId,
    points: data.points,
  };
}

export function startAuthoritativeStroke(
  strokes: readonly DrawStroke[],
  stroke: DrawStroke,
): { strokes: DrawStroke[]; created: boolean } {
  const existingIndex = strokes.findIndex((entry) => entry.id === stroke.id);

  if (existingIndex >= 0) {
    return { strokes: cloneDrawStrokes(strokes), created: false };
  }

  return {
    strokes: [...cloneDrawStrokes(strokes), { ...stroke, points: [...stroke.points] }],
    created: true,
  };
}

export function appendAuthoritativeStrokePoints(
  strokes: readonly DrawStroke[],
  strokeId: string,
  points: readonly DrawStrokePoint[],
): DrawStroke[] | null {
  const existingIndex = strokes.findIndex((stroke) => stroke.id === strokeId);

  if (existingIndex < 0) {
    return null;
  }

  return strokes.map((stroke, index) =>
    index === existingIndex
      ? { ...stroke, points: [...stroke.points, ...points] }
      : { ...stroke, points: [...stroke.points] },
  );
}

export function hasAuthoritativeStroke(
  strokes: readonly DrawStroke[],
  strokeId: string,
): boolean {
  return strokes.some((stroke) => stroke.id === strokeId);
}

export function tryStartAuthoritativeStroke(
  strokes: readonly DrawStroke[],
  stroke: DrawStroke,
  limits: DrawingBoardLimits,
): { ok: true; strokes: DrawStroke[]; created: boolean } | { ok: false } {
  if (
    stroke.points.length === 0 ||
    stroke.points.length > DRAWING_MAX_POINTS_PER_BATCH ||
    stroke.points.length > DRAWING_MAX_POINTS_PER_STROKE
  ) {
    return { ok: false };
  }

  if (hasAuthoritativeStroke(strokes, stroke.id)) {
    return { ok: true, strokes: cloneDrawStrokes(strokes), created: false };
  }

  if (strokes.length >= limits.maxStrokes) {
    return { ok: false };
  }

  if (countStrokePoints(strokes) + stroke.points.length > limits.maxTotalPoints) {
    return { ok: false };
  }

  const started = startAuthoritativeStroke(strokes, stroke);
  return { ok: true, strokes: started.strokes, created: started.created };
}

export function tryAppendAuthoritativeStrokePoints(
  strokes: readonly DrawStroke[],
  strokeId: string,
  points: readonly DrawStrokePoint[],
  limits: DrawingBoardLimits,
): { ok: true; strokes: DrawStroke[] } | { ok: false; reason: 'missing' | 'limit' } {
  if (points.length === 0 || points.length > DRAWING_MAX_POINTS_PER_BATCH) {
    return { ok: false, reason: 'limit' };
  }

  const existing = strokes.find((stroke) => stroke.id === strokeId);

  if (!existing) {
    return { ok: false, reason: 'missing' };
  }

  if (existing.points.length + points.length > DRAWING_MAX_POINTS_PER_STROKE) {
    return { ok: false, reason: 'limit' };
  }

  if (countStrokePoints(strokes) + points.length > limits.maxTotalPoints) {
    return { ok: false, reason: 'limit' };
  }

  const next = appendAuthoritativeStrokePoints(strokes, strokeId, points);

  if (!next) {
    return { ok: false, reason: 'missing' };
  }

  return { ok: true, strokes: next };
}

export function processStrokeCommand(input: {
  playerIsCurrentDrawer: boolean;
  currentTurnId: string;
  strokes: readonly DrawStroke[];
  payload: unknown;
  limits: DrawingBoardLimits;
}): ProcessStrokeResult {
  const peeked = peekStrokeCommand(input.payload);

  if (!peeked) {
    return { ok: false, error: 'invalid-payload' };
  }

  if (!input.playerIsCurrentDrawer) {
    return { ok: false, error: 'unauthorized' };
  }

  if (peeked.turnId !== input.currentTurnId) {
    return { ok: false, error: 'stale-turn' };
  }

  if (peeked.kind === 'end') {
    if (!hasAuthoritativeStroke(input.strokes, peeked.strokeId)) {
      return { ok: false, error: 'missing-stroke' };
    }

    return { ok: true, kind: 'end' };
  }

  const points = parseValidatedStrokePoints(peeked.points);

  if (!points) {
    return { ok: false, error: 'invalid-payload' };
  }

  const started = tryStartAuthoritativeStroke(
    input.strokes,
    {
      id: peeked.strokeId,
      tool: peeked.tool,
      color: peeked.color,
      size: peeked.size,
      points,
    },
    input.limits,
  );

  if (!started.ok) {
    return { ok: false, error: 'limit' };
  }

  if (!started.created) {
    return { ok: true, kind: 'start-noop' };
  }

  return { ok: true, kind: 'start', strokes: started.strokes, strokeId: peeked.strokeId };
}

export function processStrokePointsCommand(input: {
  playerIsCurrentDrawer: boolean;
  currentTurnId: string;
  strokes: readonly DrawStroke[];
  payload: unknown;
  limits: DrawingBoardLimits;
  allowedStrokeIds?: readonly string[];
}): ProcessStrokePointsResult {
  const peeked = peekStrokePointsCommand(input.payload);

  if (!peeked) {
    return { ok: false, error: 'invalid-payload' };
  }

  if (!input.playerIsCurrentDrawer) {
    return { ok: false, error: 'unauthorized' };
  }

  if (peeked.turnId !== input.currentTurnId) {
    return { ok: false, error: 'stale-turn' };
  }

  if (input.allowedStrokeIds && !input.allowedStrokeIds.includes(peeked.strokeId)) {
    return { ok: false, error: 'protected-stroke' };
  }

  const points = parseValidatedStrokePoints(peeked.points);

  if (!points) {
    return { ok: false, error: 'invalid-payload' };
  }

  const appended = tryAppendAuthoritativeStrokePoints(
    input.strokes,
    peeked.strokeId,
    points,
    input.limits,
  );

  if (!appended.ok) {
    return {
      ok: false,
      error: appended.reason === 'missing' ? 'missing-stroke' : 'limit',
    };
  }

  return {
    ok: true,
    strokes: appended.strokes,
    points,
    turnId: peeked.turnId,
    strokeId: peeked.strokeId,
  };
}
