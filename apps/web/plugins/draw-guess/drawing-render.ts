import type { DrawStroke, DrawStrokePoint } from '@wanasatna/shared';

export const DRAWING_CANVAS_WIDTH = 800;
export const DRAWING_CANVAS_HEIGHT = 500;

export function cloneDrawStrokes(strokes: readonly DrawStroke[]): DrawStroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: [...stroke.points],
  }));
}

/** Incoming snapshot is newer or structurally different and should replace live pixels. */
export function shouldReplaceStrokeSnapshot(
  live: readonly DrawStroke[],
  incoming: readonly DrawStroke[],
): boolean {
  if (live.length !== incoming.length) {
    return true;
  }

  for (let index = 0; index < incoming.length; index += 1) {
    const current = live[index];
    const next = incoming[index];

    if (!current || !next || current.id !== next.id) {
      return true;
    }

    if (next.points.length > current.points.length) {
      return true;
    }
  }

  return false;
}

export function appendPointsToStroke(
  strokes: readonly DrawStroke[],
  strokeId: string,
  points: readonly DrawStrokePoint[],
): { strokes: DrawStroke[]; fromPoint: DrawStrokePoint | null; stroke: DrawStroke } | null {
  const existingIndex = strokes.findIndex((stroke) => stroke.id === strokeId);

  if (existingIndex < 0 || points.length === 0) {
    return null;
  }

  const existing = strokes[existingIndex]!;
  const fromPoint = existing.points.at(-1) ?? null;
  const nextStroke: DrawStroke = {
    ...existing,
    points: [...existing.points, ...points],
  };

  const nextStrokes = strokes.map((stroke, index) =>
    index === existingIndex ? nextStroke : stroke,
  );

  return { strokes: nextStrokes, fromPoint, stroke: nextStroke };
}

export function upsertFinishedStroke(
  strokes: readonly DrawStroke[],
  finished: DrawStroke,
): DrawStroke[] {
  const existingIndex = strokes.findIndex((stroke) => stroke.id === finished.id);

  if (existingIndex < 0) {
    return [...strokes, { ...finished, points: [...finished.points] }];
  }

  return strokes.map((stroke, index) =>
    index === existingIndex ? { ...finished, points: [...finished.points] } : stroke,
  );
}

export function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: DrawStroke,
): void {
  if (stroke.points.length === 0) {
    return;
  }

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = stroke.size;

  if (stroke.tool === 'erase') {
    context.globalCompositeOperation = 'destination-out';
    context.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = stroke.color;
  }

  context.beginPath();
  const [first, ...rest] = stroke.points;
  context.moveTo(first!.x, first!.y);

  if (rest.length === 0) {
    context.lineTo(first!.x + 0.01, first!.y + 0.01);
  } else {
    for (const point of rest) {
      context.lineTo(point.x, point.y);
    }
  }

  context.stroke();
  context.restore();
}

export function drawStrokeSegment(
  context: CanvasRenderingContext2D,
  stroke: Pick<DrawStroke, 'tool' | 'color' | 'size'>,
  fromPoint: DrawStrokePoint | null,
  points: readonly DrawStrokePoint[],
): void {
  if (points.length === 0) {
    return;
  }

  const pathPoints = fromPoint ? [fromPoint, ...points] : [...points];

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = stroke.size;

  if (stroke.tool === 'erase') {
    context.globalCompositeOperation = 'destination-out';
    context.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = stroke.color;
  }

  context.beginPath();
  const first = pathPoints[0]!;
  context.moveTo(first.x, first.y);

  if (pathPoints.length === 1) {
    context.lineTo(first.x + 0.01, first.y + 0.01);
  } else {
    for (let index = 1; index < pathPoints.length; index += 1) {
      const point = pathPoints[index]!;
      context.lineTo(point.x, point.y);
    }
  }

  context.stroke();
  context.restore();
}

export type RenderAllStrokesOptions = {
  /** When set (including `[]`), erase only affects these current-turn strokes. */
  currentTurnStrokeIds?: readonly string[];
  frozenCanvas?: HTMLCanvasElement;
  liveCanvas?: HTMLCanvasElement;
};

export function partitionStrokesForProtectedTurn(
  strokes: readonly DrawStroke[],
  currentTurnStrokeIds: readonly string[],
  activeStroke: DrawStroke | null,
): { frozen: DrawStroke[]; live: DrawStroke[] } {
  const liveIds = new Set(currentTurnStrokeIds);

  if (activeStroke) {
    liveIds.add(activeStroke.id);
  }

  const frozen: DrawStroke[] = [];
  const live: DrawStroke[] = [];

  for (const stroke of strokes) {
    if (activeStroke && stroke.id === activeStroke.id) {
      continue;
    }

    if (liveIds.has(stroke.id)) {
      live.push(stroke);
    } else {
      frozen.push(stroke);
    }
  }

  if (activeStroke) {
    live.push(activeStroke);
  }

  return { frozen, live };
}

export function createDrawingLayerCanvas(): HTMLCanvasElement {
  const layer = document.createElement('canvas');
  layer.width = DRAWING_CANVAS_WIDTH;
  layer.height = DRAWING_CANVAS_HEIGHT;
  return layer;
}

export function renderStrokeLayer(
  canvas: HTMLCanvasElement,
  strokes: readonly DrawStroke[],
  background: 'white' | 'clear',
): void {
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.clearRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);

  if (background === 'white') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);
  }

  for (const stroke of strokes) {
    drawStroke(context, stroke);
  }
}

export function compositeProtectedDrawing(
  visible: HTMLCanvasElement,
  frozen: HTMLCanvasElement,
  live: HTMLCanvasElement,
): void {
  const context = visible.getContext('2d');

  if (!context) {
    return;
  }

  context.save();
  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);
  context.drawImage(frozen, 0, 0);
  context.drawImage(live, 0, 0);
  context.restore();
}

export function renderAllStrokes(
  canvas: HTMLCanvasElement,
  strokes: readonly DrawStroke[],
  activeStroke: DrawStroke | null,
  options?: RenderAllStrokesOptions,
): void {
  if (options?.currentTurnStrokeIds !== undefined) {
    const frozenCanvas = options.frozenCanvas ?? createDrawingLayerCanvas();
    const liveCanvas = options.liveCanvas ?? createDrawingLayerCanvas();
    const { frozen, live } = partitionStrokesForProtectedTurn(
      strokes,
      options.currentTurnStrokeIds,
      activeStroke,
    );
    renderStrokeLayer(frozenCanvas, frozen, 'white');
    renderStrokeLayer(liveCanvas, live, 'clear');
    compositeProtectedDrawing(canvas, frozenCanvas, liveCanvas);
    return;
  }

  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.clearRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);

  for (const stroke of strokes) {
    if (activeStroke && stroke.id === activeStroke.id) {
      continue;
    }

    drawStroke(context, stroke);
  }

  if (activeStroke) {
    drawStroke(context, activeStroke);
  }
}
