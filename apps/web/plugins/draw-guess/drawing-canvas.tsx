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
  drawStrokeSegment,
  renderAllStrokes,
  shouldReplaceStrokeSnapshot,
  upsertFinishedStroke,
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
      onStrokeStart,
      onStrokePoints,
      onStrokeEnd,
      className,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const activeStrokeRef = useRef<DrawStroke | null>(null);
    const lastEmitAtRef = useRef(0);
    const pendingPointsRef = useRef<DrawStrokePoint[]>([]);
    const committedStrokesRef = useRef<DrawStroke[]>(cloneDrawStrokes(strokes));
    const paintedRef = useRef(false);
    const pendingRemotePointsRef = useRef(new Map<string, DrawStrokePoint[]>());

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
          drawStrokeSegment(context, appended.stroke, appended.fromPoint, points);
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
          drawStrokeSegment(context, appended.stroke, appended.fromPoint, points);
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const incoming = strokes;
      const shouldReplace =
        !paintedRef.current || shouldReplaceStrokeSnapshot(committedStrokesRef.current, incoming);

      if (!shouldReplace) {
        return;
      }

      committedStrokesRef.current = cloneDrawStrokes(incoming);
      renderAllStrokes(canvas, committedStrokesRef.current, activeStrokeRef.current);
      paintedRef.current = true;
      flushPendingRemotePoints(canvas.getContext('2d'));
    }, [strokes]);

    useEffect(() => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const redraw = () => {
        renderAllStrokes(canvas, committedStrokesRef.current, activeStrokeRef.current);
      };

      window.addEventListener('resize', redraw);
      return () => {
        window.removeEventListener('resize', redraw);
      };
    }, []);

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
      pendingPointsRef.current = [];
      lastEmitAtRef.current = Date.now();
      drawStrokeSegment(context, stroke, null, [point]);
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
      drawStrokeSegment(context, activeStroke, fromPoint, [point]);
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
