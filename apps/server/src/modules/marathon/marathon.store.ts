import type { MarathonState } from '@wanasatna/shared';

const states = new Map<string, MarathonState>();

export function getMarathonState(roomId: string): MarathonState | null {
  return states.get(roomId) ?? null;
}

export function setMarathonState(state: MarathonState): void {
  states.set(state.roomId, state);
}

export function hasMarathonState(roomId: string): boolean {
  return states.has(roomId);
}

export function isMarathonParticipationLocked(roomId: string): boolean {
  const state = states.get(roomId);
  return Boolean(state && state.status !== 'PREPARING');
}

export function deleteMarathonState(roomId: string): void {
  states.delete(roomId);
}
