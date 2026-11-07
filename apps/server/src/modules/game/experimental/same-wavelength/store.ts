import type { SameWavelengthMatchState } from './state.js';

const matchesByRoomId = new Map<string, SameWavelengthMatchState>();

export function getSameWavelengthMatch(roomId: string): SameWavelengthMatchState | null {
  return matchesByRoomId.get(roomId) ?? null;
}

export function setSameWavelengthMatch(roomId: string, match: SameWavelengthMatchState): void {
  matchesByRoomId.set(roomId, match);
}

export function deleteSameWavelengthMatch(roomId: string): void {
  matchesByRoomId.delete(roomId);
}

export function clearAllSameWavelengthMatchesForTests(): void {
  matchesByRoomId.clear();
}
