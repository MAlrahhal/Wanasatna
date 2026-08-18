import type { Server } from 'socket.io';
import type { BaraAlSalafaMatchState } from '@wanasatna/shared';
import { BARA_AL_SALAFA_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { resolveEnabledCategoryFilter } from '../../runtime/round-category-store.js';
import { startPhaseTimerIfNeeded } from './phase-timer.js';
import { createMatchState } from './state.js';
import { getBaraAlSalafaState, setBaraAlSalafaState } from './store.js';

function resolveMatchPlayers(shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>) {
  const participantIds = new Set(
    shell.matchParticipantIds ??
      shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return shell.players.filter((player) => participantIds.has(player.id));
}

export function ensureBaraAlSalafaMatchState(roomId: string): BaraAlSalafaMatchState | null {
  const existing = getBaraAlSalafaState(roomId);

  if (existing) {
    return existing;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.gameId !== BARA_AL_SALAFA_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }

  const content = getLoadedGameContent(BARA_AL_SALAFA_GAME_ID);

  if (!content) {
    return null;
  }

  const matchPlayers = resolveMatchPlayers(shell);

  // createMatchState only seats connected players and throws when none exist;
  // return null so callers handle the empty room instead of crashing.
  if (!matchPlayers.some((player) => player.isConnected)) {
    return null;
  }

  const match = createMatchState(
    matchPlayers,
    content.bundle,
    content.settings,
    resolveEnabledCategoryFilter(roomId),
    roomId,
  );
  setBaraAlSalafaState(roomId, match);
  return match;
}

export function ensureBaraAlSalafaMatchStateWithTimer(
  io: Server,
  roomId: string,
): BaraAlSalafaMatchState | null {
  const match = ensureBaraAlSalafaMatchState(roomId);

  if (match) {
    startPhaseTimerIfNeeded(io, roomId);
  }

  return match;
}
