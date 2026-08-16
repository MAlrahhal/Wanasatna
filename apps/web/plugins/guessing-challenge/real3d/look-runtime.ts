'use client';

type LookPose = { yaw: number; pitch: number };

const looks = new Map<string, LookPose>();
let invalidateCanvas: (() => void) | null = null;

export function registerGcCanvasInvalidator(fn: () => void): () => void {
  invalidateCanvas = fn;
  return () => {
    if (invalidateCanvas === fn) {
      invalidateCanvas = null;
    }
  };
}

export function invalidateGcCanvas(): void {
  invalidateCanvas?.();
}

export function setGcLook(playerId: string, yaw: number, pitch: number): void {
  const prev = looks.get(playerId);
  if (prev && prev.yaw === yaw && prev.pitch === pitch) {
    return;
  }
  looks.set(playerId, { yaw, pitch });
  invalidateGcCanvas();
}

export function getGcLook(playerId: string | undefined | null): LookPose | undefined {
  if (!playerId) {
    return undefined;
  }
  return looks.get(playerId);
}

export function clearGcLooks(): void {
  looks.clear();
}
