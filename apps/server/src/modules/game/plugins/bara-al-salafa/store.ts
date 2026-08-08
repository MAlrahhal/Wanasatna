import type { BaraAlSalafaMatchState } from '@wanasatna/shared';

const statesByRoomId = new Map<string, BaraAlSalafaMatchState>();

export function getBaraAlSalafaState(roomId: string): BaraAlSalafaMatchState | null {
  return statesByRoomId.get(roomId) ?? null;
}

export function setBaraAlSalafaState(roomId: string, state: BaraAlSalafaMatchState): void {
  statesByRoomId.set(roomId, state);
}

export function deleteBaraAlSalafaState(roomId: string): void {
  statesByRoomId.delete(roomId);
}
