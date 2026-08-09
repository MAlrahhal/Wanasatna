import type { Server } from 'socket.io';
import type { FastAnswerMatchState } from '@wanasatna/shared';
import { FAST_ANSWER_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { startFastAnswerPhaseTimerIfNeeded } from './phase-timer.js';
import { createMatchState } from './state.js';
import { getFastAnswerState, setFastAnswerState } from './store.js';

function resolveMatchPlayers(shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>) {
  const participantIds = new Set(
    shell.matchParticipantIds ??
      shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return shell.players.filter((player) => participantIds.has(player.id));
}

export function ensureFastAnswerMatchState(roomId: string): FastAnswerMatchState | null {
  const existing = getFastAnswerState(roomId);

  if (existing) {
    return existing;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.gameId !== FAST_ANSWER_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }

  const content = getLoadedGameContent(FAST_ANSWER_GAME_ID);

  if (!content) {
    return null;
  }

  const matchPlayers = resolveMatchPlayers(shell);

  if (matchPlayers.length === 0 || !matchPlayers.some((player) => player.isConnected)) {
    return null;
  }

  const match = createMatchState(roomId, matchPlayers, content.settings);
  setFastAnswerState(roomId, match);
  return match;
}

export function ensureFastAnswerMatchStateWithTimer(
  io: Server,
  roomId: string,
): FastAnswerMatchState | null {
  const match = ensureFastAnswerMatchState(roomId);

  if (match) {
    startFastAnswerPhaseTimerIfNeeded(io, roomId);
  }

  return match;
}
