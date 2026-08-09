import type { TimingChallengeMatchState, TimingChallengeSettings } from '@wanasatna/shared';

const matchByRoomId = new Map<string, TimingChallengeMatchState>();
const settingsByRoomId = new Map<string, TimingChallengeSettings>();

export function getTimingChallengeState(roomId: string): TimingChallengeMatchState | null {
  return matchByRoomId.get(roomId) ?? null;
}

export function setTimingChallengeState(roomId: string, match: TimingChallengeMatchState): void {
  matchByRoomId.set(roomId, match);
}

export function deleteTimingChallengeState(roomId: string): void {
  matchByRoomId.delete(roomId);
}

export function getTimingChallengeSettings(roomId: string): TimingChallengeSettings | null {
  return settingsByRoomId.get(roomId) ?? null;
}

export function setTimingChallengeSettings(roomId: string, settings: TimingChallengeSettings): void {
  settingsByRoomId.set(roomId, settings);
}

export function clearTimingChallengeSettings(roomId: string): void {
  settingsByRoomId.delete(roomId);
}
