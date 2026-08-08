import type { ImposterDrawMatchState } from '@wanasatna/shared';

const statesByRoomId = new Map<string, ImposterDrawMatchState>();

export function getImposterDrawState(roomId: string): ImposterDrawMatchState | null {
  return statesByRoomId.get(roomId) ?? null;
}

export function setImposterDrawState(roomId: string, state: ImposterDrawMatchState): void {
  statesByRoomId.set(roomId, state);
}

export function deleteImposterDrawState(roomId: string): void {
  statesByRoomId.delete(roomId);
}
