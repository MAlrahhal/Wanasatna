import type { Server } from 'socket.io';
import { ONE_WORD_ONLY_GAME_ID } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { getOneWordOnlyLobbySettings } from './lobby-settings.js';
import { restartOneWordOnlyTimer } from './phase-timer.js';
import { createOneWordOnlyMatch } from './state.js';
import { getOneWordOnlyMatch, setOneWordOnlyMatch } from './store.js';

export function ensureOneWordOnlyMatch(io: Server, roomId: string) {
  const existing = getOneWordOnlyMatch(roomId);
  if (existing) {
    restartOneWordOnlyTimer(io, roomId);
    return existing;
  }
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.gameId !== ONE_WORD_ONLY_GAME_ID || shell.phase !== 'PLAYING') return null;
  const playerIds = shell.matchParticipantIds ?? [];
  if (playerIds.length < 3) return null;
  const match = createOneWordOnlyMatch({
    playerIds,
    playerNames: Object.fromEntries(shell.players.map((player) => [player.id, player.name])),
    settings: getOneWordOnlyLobbySettings(roomId),
  });
  if (!pluginParticipantsMatchShell(shell, match.playerIds)) return null;
  setOneWordOnlyMatch(roomId, match);
  restartOneWordOnlyTimer(io, roomId);
  return match;
}
