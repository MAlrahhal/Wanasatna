import type { JudgeMatchState } from '@wanasatna/shared';

const matchByRoomId = new Map<string, JudgeMatchState>();

export function getJudgeState(roomId: string): JudgeMatchState | null {
  return matchByRoomId.get(roomId) ?? null;
}

export function setJudgeState(roomId: string, match: JudgeMatchState): void {
  matchByRoomId.set(roomId, match);
}

export function deleteJudgeState(roomId: string): void {
  matchByRoomId.delete(roomId);
}
