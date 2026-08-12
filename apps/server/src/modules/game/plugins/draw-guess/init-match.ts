import type { Server } from 'socket.io';
import type { DrawGuessMatchState } from '@wanasatna/shared';
import { DRAW_GUESS_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { getDrawGuessRoomDrawerSettings } from './drawer-mode-store.js';
import { startDrawGuessPhaseTimerIfNeeded } from './phase-timer.js';
import { createMatchState } from './state.js';
import { getDrawGuessState, setDrawGuessState } from './store.js';

function resolveMatchPlayers(shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>) {
  const participantIds = new Set(
    shell.matchParticipantIds ??
      shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return shell.players.filter((player) => participantIds.has(player.id));
}

export function ensureDrawGuessMatchState(roomId: string): DrawGuessMatchState | null {
  const existing = getDrawGuessState(roomId);

  if (existing) {
    return existing;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.gameId !== DRAW_GUESS_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }

  const content = getLoadedGameContent(DRAW_GUESS_GAME_ID);

  if (!content) {
    return null;
  }

  const matchPlayers = resolveMatchPlayers(shell);

  if (matchPlayers.length === 0 || !matchPlayers.some((player) => player.isConnected)) {
    return null;
  }

  const drawerSettings = getDrawGuessRoomDrawerSettings(roomId);
  const match = createMatchState(
    roomId,
    matchPlayers,
    content.settings,
    drawerSettings?.drawerMode ?? 'random',
    drawerSettings?.fixedPlayerId ?? null,
  );
  setDrawGuessState(roomId, match);
  return match;
}

export function ensureDrawGuessMatchStateWithTimer(
  io: Server,
  roomId: string,
): DrawGuessMatchState | null {
  const match = ensureDrawGuessMatchState(roomId);

  if (match) {
    startDrawGuessPhaseTimerIfNeeded(io, roomId);
  }

  return match;
}
