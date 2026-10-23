import type { Server } from 'socket.io';
import { MOST_LIKELY_TO_GAME_ID } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { restartMostLikelyToTimer } from './phase-timer.js';
import { createMostLikelyToMatch } from './state.js';
import { getMostLikelyToMatch, setMostLikelyToMatch } from './store.js';

export function ensureMostLikelyToMatch(io: Server, roomId: string) {
  const existing = getMostLikelyToMatch(roomId);
  if (existing) return existing;

  const shell = getGameShellByRoomId(roomId);
  if (
    !shell ||
    shell.gameId !== MOST_LIKELY_TO_GAME_ID ||
    shell.phase !== 'PLAYING' ||
    !shell.matchParticipantIds
  ) {
    return null;
  }
  const participantSet = new Set(shell.matchParticipantIds);
  const participants = shell.players
    .filter((player) => participantSet.has(player.id))
    .map((player) => ({ playerId: player.id, name: player.name }));
  const match = createMostLikelyToMatch({ participants });
  if (!pluginParticipantsMatchShell(shell, match.playerIds)) return null;
  setMostLikelyToMatch(roomId, match);
  restartMostLikelyToTimer(io, roomId);
  return match;
}
