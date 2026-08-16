'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { DrawGuessTool, DrawStroke, DrawStrokePoint } from '@wanasatna/shared';
import { cn } from '@/lib/utils';
import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  appendPointsToStroke,
  cloneDrawStrokes,
  compositeProtectedDrawing,
  createDrawingLayerCanvas,
  drawStrokeSegment,
  renderAllStrokes,
  shouldReplaceStrokeSnapshot,
  upsertFinishedStroke,
  type RenderAllStrokesOptions,
} from './drawing-render';

const CANVAS_WIDTH = DRAWING_CANVAS_WIDTH;
const CANVAS_HEIGHT = DRAWING_CANVAS_HEIGHT;
const POINT_THROTTLE_MS = 40;

export type DrawingCanvasHandle = {
  appendRemotePoints: (strokeId: string, points: readonly DrawStrokePoint[]) => void;
};

export type DrawingCanvasProps = {
  strokes: readonly DrawStroke[];
  readOnly?: boolean;
  tool?: DrawGuessTool;
  color?: string;
  size?: number;
  /** Imposter Draw: current-turn stroke ids. Omit for Draw Guess (full-board erase). */
  currentTurnStrokeIds?: readonly string[];
  turnId?: string;
  onStrokeStart?: (payload: {
    strokeId: string;
    tool: DrawGuessTool;
    color: string;
    size: number;
    points: DrawStrokePoint[];
  }) => void;
  onStrokePoints?: (payload: { strokeId: string; points: DrawStrokePoint[] }) => void;
  onStrokeEnd?: (payload: { strokeId: string }) => void;
  className?: string;
};

function createStrokeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    {
      strokes,
      readOnly = false,
      tool = 'draw',
      color = '#111827',
      size = 8,
      currentTurnStrokeIds,
      turnId,
      onStrokeStart,
      onStrokePoints,
      onStrokeEnd,
      className,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const frozenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const activeStrokeRef = useRef<DrawStroke | null>(null);
    const lastEmitAtRef = useRef(0);
    const pendingPointsRef = useRef<DrawStrokePoint[]>([]);
    const committedStrokesRef = useRef<DrawStroke[]>(cloneDrawStrokes(strokes));
    const paintedRef = useRef(false);
    const pendingRemotePointsRef = useRef(new Map<string, DrawStrokePoint[]>());
    const localLiveStrokeIdsRef = useRef(new Set<string>());
    const lastProtectKeyRef = useRef<string | null>(null);

    function ensureLayerCanvas(
      layerRef: { current: HTMLCanvasElement | null },
    ): HTMLCanvasElement {
      if (!layerRef.current) {
        layerRef.current = createDrawingLayerCanvas();
      }

      return layerRef.current;
    }

    function resolveProtectOptions(): RenderAllStrokesOptions | undefined {
      if (currentTurnStrokeIds === undefined) {
        return undefined;
      }

      const liveIds = new Set(currentTurnStrokeIds);

      for (const strokeId of localLiveStrokeIdsRef.current) {
        liveIds.add(strokeId);
      }

      if (activeStrokeRef.current) {
        liveIds.add(activeStrokeRef.current.id);
      }

      return {
        currentTurnStrokeIds: [...liveIds],
        frozenCanvas: ensureLayerCanvas(frozenCanvasRef),
        liveCanvas: ensureLayerCanvas(liveCanvasRef),
      };
    }

    function paintSegment(
      visibleContext: CanvasRenderingContext2D,
      stroke: Pick<DrawStroke, 'tool' | 'color' | 'size'> & { id?: string },
      fromPoint: DrawStrokePoint | null,
      points: readonly DrawStrokePoint[],
      strokeId?: string,
    ): void {
      const protect = resolveProtectOptions();
      const canvas = canvasRef.current;

      if (!protect || !canvas) {
        drawStrokeSegment(visibleContext, stroke, fromPoint, points);
        return;
      }

      const liveIds = new Set(protect.currentTurnStrokeIds);

      if (strokeId && !liveIds.has(strokeId)) {
        renderAllStrokes(canvas, committedStrokesRef.current, activeStrokeRef.current, protect);
        return;
      }

      const liveCanvas = protect.liveCanvas;
      const frozenCanvas = protect.frozenCanvas;
      const liveContext = liveCanvas?.getContext('2d');

      if (!liveCanvas || !frozenCanvas || !liveContext) {
        drawStrokeSegment(visibleContext, stroke, fromPoint, points);
        return;
      }

      drawStrokeSegment(liveContext, stroke, fromPoint, points);
      compositeProtectedDrawing(canvas, frozenCanvas, liveCanvas);
    }

    function flushPendingRemotePoints(context: CanvasRenderingContext2D | null): void {
      for (const [strokeId, points] of pendingRemotePointsRef.current) {
        if (activeStrokeRef.current?.id === strokeId) {
          pendingRemotePointsRef.current.delete(strokeId);
          continue;
        }

        const appended = appendPointsToStroke(committedStrokesRef.current, strokeId, points);

        if (!appended) {
          continue;
        }

        pendingRemotePointsRef.current.delete(strokeId);
        committedStrokesRef.current = appended.strokes;

        if (context) {
          paintSegment(context, appended.stroke, appended.fromPoint, points, strokeId);
        }
      }

      const liveIds = new Set(committedStrokesRef.current.map((stroke) => stroke.id));

      for (const strokeId of pendingRemotePointsRef.current.keys()) {
        if (!liveIds.has(strokeId)) {
          pendingRemotePointsRef.current.delete(strokeId);
        }
      }
    }

    useImperativeHandle(ref, () => ({
      appendRemotePoints(strokeId, points) {
        if (activeStrokeRef.current?.id === strokeId || points.length === 0) {
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const appended = appendPointsToStroke(committedStrokesRef.current, strokeId, points);

        if (!appended) {
          const queued = pendingRemotePointsRef.current.get(strokeId) ?? [];
          pendingRemotePointsRef.current.set(strokeId, [...queued, ...points]);
          return;
        }

        committedStrokesRef.current = appended.strokes;

        if (context) {
          paintSegment(context, appended.stroke, appended.fromPoint, points, strokeId);
        }
      },
    }));

    useEffect(() => {
      localLiveStrokeIdsRef.current.clear();
    }, [turnId]);

    useEffect(() => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const incoming = strokes;
      const protectKey =
        currentTurnStrokeIds === undefined ? null : currentTurnStrokeIds.join('\0');
      const shouldReplace =
        !paintedRef.current ||
        shouldReplaceStrokeSnapshot(committedStrokesRef.current, incoming) ||
        protectKey !== lastProtectKeyRef.current;

      if (!shouldReplace) {
        return;
      }

      lastProtectKeyRef.current = protectKey;
      committedStrokesRef.current = cloneDrawStrokes(incoming);
      renderAllStrokes(
        canvas,
        committedStrokesRef.current,
        activeStrokeRef.current,
        resolveProtectOptions(),
      );
      paintedRef.current = true;
      flushPendingRemotePoints(canvas.getContext('2d'));
    }, [strokes, currentTurnStrokeIds]);

    useEffect(() => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const redraw = () => {
        renderAllStrokes(
          canvas,
          committedStrokesRef.current,
          activeStrokeRef.current,
          resolveProtectOptions(),
        );
      };

      window.addEventListener('resize', redraw);
      return () => {
        window.removeEventListener('resize', redraw);
      };
    }, [currentTurnStrokeIds]);

    function pointerToCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>): DrawStrokePoint {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 1;
      const height = rect.height || 1;

      return {
        x: ((event.clientX - rect.left) / width) * CANVAS_WIDTH,
        y: ((event.clientY - rect.top) / height) * CANVAS_HEIGHT,
      };
    }

    function flushPendingPoints(force = false): void {
      const activeStroke = activeStrokeRef.current;
      const pending = pendingPointsRef.current;

      if (!activeStroke || pending.length === 0) {
        return;
      }

      const now = Date.now();

      if (!force && now - lastEmitAtRef.current < POINT_THROTTLE_MS) {
        return;
      }

      lastEmitAtRef.current = now;
      const points = pending.splice(0, pending.length);
      onStrokePoints?.({ strokeId: activeStroke.id, points });
    }

    function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
      if (readOnly) {
        return;
      }

      event.preventDefault();
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');

      if (!canvas || !context) {
        return;
      }

      canvas.setPointerCapture(event.pointerId);
      const point = pointerToCanvasPoint(event);
      const stroke: DrawStroke = {
        id: createStrokeId(),
        tool,
        color,
        size,
        points: [point],
      };

      activeStrokeRef.current = stroke;
      localLiveStrokeIdsRef.current.add(stroke.id);
      pendingPointsRef.current = [];
      lastEmitAtRef.current = Date.now();
      paintSegment(context, stroke, null, [point], stroke.id);
      onStrokeStart?.({
        strokeId: stroke.id,
        tool: stroke.tool,
        color: stroke.color,
        size: stroke.size,
        points: [point],
      });
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
      if (readOnly || !activeStrokeRef.current) {
        return;
      }

      event.preventDefault();
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');

      if (!canvas || !context) {
        return;
      }

      const point = pointerToCanvasPoint(event);
      const activeStroke = activeStrokeRef.current;
      const fromPoint = activeStroke.points.at(-1) ?? null;
      activeStroke.points.push(point);
      pendingPointsRef.current.push(point);
      paintSegment(context, activeStroke, fromPoint, [point], activeStroke.id);
      flushPendingPoints();
    }

    function endStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
      if (readOnly || !activeStrokeRef.current) {
        return;
      }

      event.preventDefault();
      flushPendingPoints(true);

      const finished = activeStrokeRef.current;
      activeStrokeRef.current = null;
      pendingPointsRef.current = [];
      localLiveStrokeIdsRef.current.add(finished.id);
      committedStrokesRef.current = upsertFinishedStroke(committedStrokesRef.current, finished);
      onStrokeEnd?.({ strokeId: finished.id });
    }

    return (
      <div
        className={cn(
          'overflow-hidden rounded-[1.25rem] border border-[color:var(--wanas-game-card-border)] bg-white shadow-sm',
          className,
        )}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={cn(
            'block w-full touch-none',
            'h-[min(36dvh,_240px)] min-h-[10rem] lg:h-auto lg:min-h-0 lg:aspect-[8/5]',
            readOnly ? 'cursor-default' : 'cursor-crosshair',
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={(event) => {
            if (activeStrokeRef.current) {
              endStroke(event);
            }
          }}
        />
      </div>
    );
  },
);
