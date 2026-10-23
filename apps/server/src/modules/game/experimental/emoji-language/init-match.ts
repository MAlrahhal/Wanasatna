import type { Server } from 'socket.io';
import { EMOJI_LANGUAGE_GAME_ID } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { getEmojiLanguageLobbySettings } from './lobby-settings.js';
import { restartEmojiLanguageTimer } from './phase-timer.js';
import { createEmojiLanguageMatch } from './state.js';
import { getEmojiLanguageMatch, setEmojiLanguageMatch } from './store.js';

export function ensureEmojiLanguageMatch(io: Server, roomId: string) {
  const existing = getEmojiLanguageMatch(roomId);
  if (existing) {
    restartEmojiLanguageTimer(io, roomId);
    return existing;
  }
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.gameId !== EMOJI_LANGUAGE_GAME_ID || shell.phase !== 'PLAYING') return null;
  const playerIds = shell.matchParticipantIds ?? [];
  if (playerIds.length < 2) return null;
  const match = createEmojiLanguageMatch({
    playerIds,
    playerNames: Object.fromEntries(shell.players.map((player) => [player.id, player.name])),
    settings: getEmojiLanguageLobbySettings(roomId),
  });
  if (!pluginParticipantsMatchShell(shell, match.playerIds)) return null;
  setEmojiLanguageMatch(roomId, match);
  restartEmojiLanguageTimer(io, roomId);
  return match;
}
