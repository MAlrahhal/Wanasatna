import type { WhoWroteItMatchState } from '@wanasatna/shared';

const matchByRoomId = new Map<string, WhoWroteItMatchState>();

export function getWhoWroteItState(roomId: string): WhoWroteItMatchState | null {
  return matchByRoomId.get(roomId) ?? null;
}

export function setWhoWroteItState(roomId: string, match: WhoWroteItMatchState): void {
  matchByRoomId.set(roomId, match);
}

export function deleteWhoWroteItState(roomId: string): void {
  matchByRoomId.delete(roomId);
}
