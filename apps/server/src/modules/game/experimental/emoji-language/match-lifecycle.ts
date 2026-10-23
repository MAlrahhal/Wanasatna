import type { Server } from 'socket.io';
import { teardownShellAndReturnToLobby } from '../../game.lifecycle.js';
import { persistCompletedMatchThen } from '../../runtime/persist-completed-match.js';
import { clearEmojiLanguageLobbySettings } from './lobby-settings.js';
import { clearEmojiLanguageTimerRuntime } from './phase-timer.js';
import { deleteEmojiLanguageMatch, getEmojiLanguageMatch } from './store.js';

export function cleanupEmojiLanguageRuntime(roomId: string): void {
  clearEmojiLanguageTimerRuntime(roomId);
  deleteEmojiLanguageMatch(roomId);
  clearEmojiLanguageLobbySettings(roomId);
}

export function completeEmojiLanguageMatch(io: Server, roomId: string): void {
  if (!getEmojiLanguageMatch(roomId)) return;
  void persistCompletedMatchThen(roomId, () => {
    cleanupEmojiLanguageRuntime(roomId);
    teardownShellAndReturnToLobby(io, roomId);
  });
}
