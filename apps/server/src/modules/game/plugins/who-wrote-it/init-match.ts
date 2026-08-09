import type { Server } from 'socket.io';
import type { WhoWroteItMatchState } from '@wanasatna/shared';
import { WHO_WROTE_IT_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { startWhoWroteItPhaseTimerIfNeeded } from './phase-timer.js';
import { createMatchState } from './state.js';
import { getWhoWroteItState, setWhoWroteItState } from './store.js';

function resolveMatchPlayers(shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>) {
  const participantIds = new Set(
    shell.matchParticipantIds ??
      shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return shell.players.filter((player) => participantIds.has(player.id));
}

export function ensureWhoWroteItMatchState(roomId: string): WhoWroteItMatchState | null {
  const existing = getWhoWroteItState(roomId);

  if (existing) {
    return existing;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.gameId !== WHO_WROTE_IT_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }

  const content = getLoadedGameContent(WHO_WROTE_IT_GAME_ID);

  if (!content) {
    return null;
  }

  const matchPlayers = resolveMatchPlayers(shell);

  if (matchPlayers.length === 0 || !matchPlayers.some((player) => player.isConnected)) {
    return null;
  }

  const match = createMatchState(roomId, matchPlayers, content.settings);
  setWhoWroteItState(roomId, match);
  return match;
}

export function ensureWhoWroteItMatchStateWithTimer(
  io: Server,
  roomId: string,
): WhoWroteItMatchState | null {
  const match = ensureWhoWroteItMatchState(roomId);

  if (match) {
    startWhoWroteItPhaseTimerIfNeeded(io, roomId);
  }

  return match;
}
