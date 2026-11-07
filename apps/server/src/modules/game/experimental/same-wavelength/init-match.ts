import type { Server } from 'socket.io';
import { SAME_WAVELENGTH_GAME_ID } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { getSameWavelengthLobbyState } from './lobby-state.js';
import { restartSameWavelengthTimer } from './phase-timer.js';
import { createSameWavelengthMatch } from './state.js';
import { getSameWavelengthMatch, setSameWavelengthMatch } from './store.js';

export function ensureSameWavelengthMatch(io: Server, roomId: string) {
  const existing = getSameWavelengthMatch(roomId);
  if (existing) {
    restartSameWavelengthTimer(io, roomId);
    return existing;
  }
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.gameId !== SAME_WAVELENGTH_GAME_ID || shell.phase !== 'PLAYING') return null;
  const playerIds = shell.matchParticipantIds ?? [];
  const lobby = getSameWavelengthLobbyState(roomId);
  const match = createSameWavelengthMatch({
    playerIds,
    playerNames: Object.fromEntries(shell.players.map((player) => [player.id, player.name])),
    settings: lobby.settings,
    assignments: lobby.settings.mode === 'team' ? lobby.assignments : {},
  });
  if (!pluginParticipantsMatchShell(shell, match.playerIds)) return null;
  setSameWavelengthMatch(roomId, match);
  restartSameWavelengthTimer(io, roomId);
  return match;
}
