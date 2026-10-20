import type { SecretAgentsMatchState } from './state.js';

const matchesByRoomId = new Map<string, SecretAgentsMatchState>();

export function getSecretAgentsMatch(roomId: string): SecretAgentsMatchState | null {
  return matchesByRoomId.get(roomId) ?? null;
}

export function setSecretAgentsMatch(roomId: string, match: SecretAgentsMatchState): void {
  matchesByRoomId.set(roomId, match);
}

export function deleteSecretAgentsMatch(roomId: string): void {
  matchesByRoomId.delete(roomId);
}
