import type { FastAnswerMatchState } from '@wanasatna/shared';

const matchByRoomId = new Map<string, FastAnswerMatchState>();

export function getFastAnswerState(roomId: string): FastAnswerMatchState | null {
  return matchByRoomId.get(roomId) ?? null;
}

export function setFastAnswerState(roomId: string, match: FastAnswerMatchState): void {
  matchByRoomId.set(roomId, match);
}

export function deleteFastAnswerState(roomId: string): void {
  matchByRoomId.delete(roomId);
}
