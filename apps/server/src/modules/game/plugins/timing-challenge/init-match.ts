import type { Server } from 'socket.io';
import type { TimingChallengeMatchState } from '@wanasatna/shared';
import { TIMING_CHALLENGE_GAME_ID } from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import { startTimingChallengePhaseTimerIfNeeded } from './phase-timer.js';
import { defaultTimingChallengeSettings } from './settings.js';
import { createMatchState } from './state.js';
import {
  getTimingChallengeSettings,
  getTimingChallengeState,
  setTimingChallengeState,
} from './store.js';

function resolveMatchPlayers(shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>) {
  const participantIds = new Set(
    shell.matchParticipantIds ??
      shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return shell.players.filter((player) => participantIds.has(player.id));
}

export function ensureTimingChallengeMatchState(roomId: string): TimingChallengeMatchState | null {
  const existing = getTimingChallengeState(roomId);

  if (existing) {
    return existing;
  }

  const shell = getGameShellByRoomId(roomId);

  if (!shell || shell.gameId !== TIMING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }

  const matchPlayers = resolveMatchPlayers(shell);

  if (matchPlayers.length === 0 || !matchPlayers.some((player) => player.isConnected)) {
    return null;
  }

  const settings = getTimingChallengeSettings(roomId) ?? defaultTimingChallengeSettings();
  const match = createMatchState(matchPlayers, settings);
  setTimingChallengeState(roomId, match);
  return match;
}

export function ensureTimingChallengeMatchStateWithTimer(
  io: Server,
  roomId: string,
): TimingChallengeMatchState | null {
  const match = ensureTimingChallengeMatchState(roomId);

  if (match) {
    startTimingChallengePhaseTimerIfNeeded(io, roomId);
  }

  return match;
}
