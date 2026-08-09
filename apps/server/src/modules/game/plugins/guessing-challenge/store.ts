import type { GuessingChallengeMatchState } from '@wanasatna/shared';

const matchByRoomId = new Map<string, GuessingChallengeMatchState>();

export function getGuessingChallengeState(roomId: string): GuessingChallengeMatchState | null {
  return matchByRoomId.get(roomId) ?? null;
}

export function setGuessingChallengeState(
  roomId: string,
  match: GuessingChallengeMatchState,
): void {
  matchByRoomId.set(roomId, match);
}

export function deleteGuessingChallengeState(roomId: string): void {
  matchByRoomId.delete(roomId);
}
