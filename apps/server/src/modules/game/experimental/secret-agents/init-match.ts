import type { Server } from 'socket.io';
import { SECRET_AGENTS_GAME_ID } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { getSecretAgentsLobbyState, validateSecretAgentsRoster } from './lobby-state.js';
import { reconcileSecretAgentsConnectivity } from './phase-timer.js';
import { createSecretAgentsMatch } from './state.js';
import { getSecretAgentsMatch, setSecretAgentsMatch } from './store.js';

export function ensureSecretAgentsMatch(io: Server, roomId: string) {
  const existing = getSecretAgentsMatch(roomId);
  if (existing) return existing;
  const shell = getGameShellByRoomId(roomId);
  if (!shell || shell.gameId !== SECRET_AGENTS_GAME_ID || shell.phase !== 'PLAYING') return null;

  const lobby = getSecretAgentsLobbyState(roomId);
  const participantIds = shell.matchParticipantIds ?? [];
  const validation = validateSecretAgentsRoster({
    assignments: lobby.assignments,
    eligiblePlayerIds: participantIds,
  });
  if (!validation.success) return null;

  const assignments = Object.fromEntries(
    participantIds.map((playerId) => [playerId, lobby.assignments[playerId]!]),
  );
  const playerNames = Object.fromEntries(shell.players.map((player) => [player.id, player.name]));
  const match = createSecretAgentsMatch({
    assignments,
    playerNames,
    settings: lobby.settings,
  });
  if (!pluginParticipantsMatchShell(shell, match.playerIds)) return null;
  setSecretAgentsMatch(roomId, match);
  reconcileSecretAgentsConnectivity(io, roomId);
  return getSecretAgentsMatch(roomId);
}
