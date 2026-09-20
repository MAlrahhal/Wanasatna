import type { Server } from 'socket.io';
import type { ImposterDrawMatchState } from '@wanasatna/shared';
import { IMPOSTER_DRAW_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { startImposterDrawPhaseTimerIfNeeded } from './phase-timer.js';
import { createMatchState } from './state.js';
import { getImposterDrawState, setImposterDrawState } from './store.js';

function resolveMatchPlayers(shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>) {
  const participantIds = new Set(
    shell.matchParticipantIds ??
      shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return shell.players.filter((player) => participantIds.has(player.id));
}

export function ensureImposterDrawMatchState(roomId: string): ImposterDrawMatchState | null {
  const existing = getImposterDrawState(roomId);
  const shell = getGameShellByRoomId(roomId);

  if (existing) {
    return shell && pluginParticipantsMatchShell(shell, existing.playerIds) ? existing : null;
  }

  if (!shell || shell.gameId !== IMPOSTER_DRAW_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }

  const content = getLoadedGameContent(IMPOSTER_DRAW_GAME_ID);

  if (!content) {
    return null;
  }

  const matchPlayers = resolveMatchPlayers(shell);

  if (matchPlayers.length === 0 || !matchPlayers.some((player) => player.isConnected)) {
    return null;
  }

  const match = createMatchState(roomId, matchPlayers, content.settings);
  if (!pluginParticipantsMatchShell(shell, match.playerIds)) {
    return null;
  }
  setImposterDrawState(roomId, match);
  return match;
}

export function ensureImposterDrawMatchStateWithTimer(
  io: Server,
  roomId: string,
): ImposterDrawMatchState | null {
  const match = ensureImposterDrawMatchState(roomId);

  if (match) {
    startImposterDrawPhaseTimerIfNeeded(io, roomId);
  }

  return match;
}
