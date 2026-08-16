import type { DrawStroke, DrawStrokePoint } from '@wanasatna/shared';

export function cloneDrawStrokes(strokes: readonly DrawStroke[]): DrawStroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: [...stroke.points],
  }));
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
