import type { DrawGuessMatchState } from '@wanasatna/shared';

const statesByRoomId = new Map<string, DrawGuessMatchState>();

export function getDrawGuessState(roomId: string): DrawGuessMatchState | null {
  return statesByRoomId.get(roomId) ?? null;
}

export function setDrawGuessState(roomId: string, state: DrawGuessMatchState): void {
  statesByRoomId.set(roomId, state);
}

export function deleteDrawGuessState(roomId: string): void {
  statesByRoomId.delete(roomId);
}
