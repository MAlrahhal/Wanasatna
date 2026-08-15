'use client';

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { DrawGuessTool, DrawStroke, DrawStrokePoint } from '@wanasatna/shared';
import { cn } from '@/lib/utils';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const POINT_THROTTLE_MS = 40;

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
  onStrokeEnd?: (payload: {
    strokeId: string;
    tool: DrawGuessTool;
    color: string;
    size: number;
    points: DrawStrokePoint[];
  }) => void;
  className?: string;
};

function createStrokeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function drawStroke(
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

function renderStrokes(
  canvas: HTMLCanvasElement,
  strokes: readonly DrawStroke[],
  activeStroke: DrawStroke | null,
): void {
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

export function DrawingCanvas({
  strokes,
  readOnly = false,
  tool = 'draw',
  color = '#111827',
  size = 8,
  onStrokeStart,
  onStrokePoints,
  onStrokeEnd,
  className,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<DrawStroke | null>(null);
  const lastEmitAtRef = useRef(0);
  const pendingPointsRef = useRef<DrawStrokePoint[]>([]);
  const strokesRef = useRef(strokes);

  strokesRef.current = strokes;

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    renderStrokes(canvas, strokes, activeStrokeRef.current);
  }, [strokes]);

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

    if (!canvas) {
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
    renderStrokes(canvas, strokesRef.current, stroke);
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

    if (!canvas) {
      return;
    }

    const point = pointerToCanvasPoint(event);
    const activeStroke = {
      ...activeStrokeRef.current,
      points: [...activeStrokeRef.current.points, point],
    };
    activeStrokeRef.current = activeStroke;
    pendingPointsRef.current.push(point);
    renderStrokes(canvas, strokesRef.current, activeStroke);
    flushPendingPoints();
  }

  function endStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (readOnly || !activeStrokeRef.current) {
      return;
    }

    event.preventDefault();
    const canvas = canvasRef.current;
    flushPendingPoints(true);

    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    pendingPointsRef.current = [];

    if (canvas) {
      renderStrokes(canvas, strokesRef.current, null);
    }

    onStrokeEnd?.({
      strokeId: finished.id,
      tool: finished.tool,
      color: finished.color,
      size: finished.size,
      points: finished.points,
    });
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
}
