import type { Server } from 'socket.io';
import { EYEWITNESS_GAME_ID } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { getEyewitnessLobbySettings } from './lobby-settings.js';
import { restartEyewitnessTimer } from './phase-timer.js';
import { createEyewitnessMatch } from './state.js';
import { getEyewitnessMatch, setEyewitnessMatch } from './store.js';

export function ensureEyewitnessMatch(io: Server, roomId: string) {
  const existing = getEyewitnessMatch(roomId);
  if (existing) {
    restartEyewitnessTimer(io, roomId);
    return existing;
  }
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.gameId !== EYEWITNESS_GAME_ID || shell.phase !== 'PLAYING') return null;
  const playerIds = shell.matchParticipantIds ?? [];
  if (playerIds.length < 3) return null;
  const match = createEyewitnessMatch({
    playerIds,
    playerNames: Object.fromEntries(shell.players.map((player) => [player.id, player.name])),
    settings: getEyewitnessLobbySettings(roomId),
  });
  if (!pluginParticipantsMatchShell(shell, match.playerIds)) return null;
  setEyewitnessMatch(roomId, match);
  restartEyewitnessTimer(io, roomId);
  return match;
}
