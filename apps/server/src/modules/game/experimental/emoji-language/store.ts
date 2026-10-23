import type { EmojiLanguageMatchState } from './state.js';

const matchesByRoomId = new Map<string, EmojiLanguageMatchState>();

export function getEmojiLanguageMatch(roomId: string): EmojiLanguageMatchState | null {
  return matchesByRoomId.get(roomId) ?? null;
}

export function setEmojiLanguageMatch(roomId: string, match: EmojiLanguageMatchState): void {
  matchesByRoomId.set(roomId, match);
}

export function deleteEmojiLanguageMatch(roomId: string): void {
  matchesByRoomId.delete(roomId);
}

export function clearAllEmojiLanguageMatchesForTests(): void {
  matchesByRoomId.clear();
}
