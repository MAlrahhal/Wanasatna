import type { MostLikelyToMatchState } from './state.js';

const matchesByRoomId = new Map<string, MostLikelyToMatchState>();

export function getMostLikelyToMatch(roomId: string): MostLikelyToMatchState | null {
  return matchesByRoomId.get(roomId) ?? null;
}

export function setMostLikelyToMatch(roomId: string, match: MostLikelyToMatchState): void {
  matchesByRoomId.set(roomId, match);
}

export function deleteMostLikelyToMatch(roomId: string): void {
  matchesByRoomId.delete(roomId);
}

export function clearAllMostLikelyToMatchesForTests(): void {
  matchesByRoomId.clear();
}
