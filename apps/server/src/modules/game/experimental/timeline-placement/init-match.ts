import type { Server } from 'socket.io';
import { TIMELINE_PLACEMENT_GAME_ID, TIMELINE_PLACEMENT_MIN_PLAYERS } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { getTimelinePlacementLobbySettings } from './lobby-settings.js';
import { restartTimelinePlacementTimer } from './phase-timer.js';
import { createTimelinePlacementMatch } from './state.js';
import { getTimelinePlacementMatch, setTimelinePlacementMatch } from './store.js';

export function ensureTimelinePlacementMatch(io: Server, roomId: string) {
  const existing = getTimelinePlacementMatch(roomId);
  if (existing) {
    restartTimelinePlacementTimer(io, roomId);
    return existing;
  }
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.gameId !== TIMELINE_PLACEMENT_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }
  const playerIds = shell.matchParticipantIds ?? [];
  if (playerIds.length < TIMELINE_PLACEMENT_MIN_PLAYERS) return null;
  const match = createTimelinePlacementMatch({
    playerIds,
    playerNames: Object.fromEntries(shell.players.map((player) => [player.id, player.name])),
    settings: getTimelinePlacementLobbySettings(roomId),
  });
  if (!pluginParticipantsMatchShell(shell, match.playerIds)) return null;
  setTimelinePlacementMatch(roomId, match);
  restartTimelinePlacementTimer(io, roomId);
  return match;
}
