import type { TimelinePlacementMatchState } from './state.js';

const matchesByRoomId = new Map<string, TimelinePlacementMatchState>();

export function getTimelinePlacementMatch(roomId: string): TimelinePlacementMatchState | null {
  return matchesByRoomId.get(roomId) ?? null;
}

export function setTimelinePlacementMatch(
  roomId: string,
  match: TimelinePlacementMatchState,
): void {
  matchesByRoomId.set(roomId, match);
}

export function deleteTimelinePlacementMatch(roomId: string): void {
  matchesByRoomId.delete(roomId);
}

export function clearAllTimelinePlacementMatchesForTests(): void {
  matchesByRoomId.clear();
}
