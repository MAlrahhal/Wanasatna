import type { Server } from 'socket.io';
import type { GuessingChallengeMatchState } from '@wanasatna/shared';
import { GUESSING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { getGuessingChallengeRoomMode } from './mode-store.js';
import { startGuessingChallengePhaseTimerIfNeeded } from './phase-timer.js';
import {
  createMatchState,
  requiredPlayerCountForMode,
  resolveGuessingChallengeMode,
} from './state.js';
import { getGuessingChallengeState, setGuessingChallengeState } from './store.js';

function resolveMatchPlayers(shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>) {
  const participantIds = new Set(
    shell.matchParticipantIds ??
      shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return shell.players.filter((player) => participantIds.has(player.id));
}

export function ensureGuessingChallengeMatchState(
  roomId: string,
): GuessingChallengeMatchState | null {
  const existing = getGuessingChallengeState(roomId);

  if (existing) {
    return existing;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }

  const content = getLoadedGameContent(GUESSING_CHALLENGE_GAME_ID);

  if (!content) {
    return null;
  }

  const matchPlayers = resolveMatchPlayers(shell);
  const roomMode = getGuessingChallengeRoomMode(roomId);
  const mode = resolveGuessingChallengeMode(content.settings, roomMode);
  const expected = requiredPlayerCountForMode(mode);

  if (matchPlayers.length !== expected || !matchPlayers.some((player) => player.isConnected)) {
    return null;
  }

  const match = createMatchState(roomId, matchPlayers, content.settings, mode);
  setGuessingChallengeState(roomId, match);
  return match;
}

export function ensureGuessingChallengeMatchStateWithTimer(
  io: Server,
  roomId: string,
): GuessingChallengeMatchState | null {
  const match = ensureGuessingChallengeMatchState(roomId);

  if (match) {
    startGuessingChallengePhaseTimerIfNeeded(io, roomId);
  }

  return match;
}
