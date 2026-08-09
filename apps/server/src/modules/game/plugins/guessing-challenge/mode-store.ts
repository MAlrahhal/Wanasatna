import type { GuessingChallengeMode } from '@wanasatna/shared';

const modeByRoomId = new Map<string, GuessingChallengeMode>();

export function setGuessingChallengeRoomMode(roomId: string, mode: GuessingChallengeMode): void {
  modeByRoomId.set(roomId, mode);
}

export function getGuessingChallengeRoomMode(roomId: string): GuessingChallengeMode | null {
  return modeByRoomId.get(roomId) ?? null;
}

export function clearGuessingChallengeRoomMode(roomId: string): void {
  modeByRoomId.delete(roomId);
}
