import type { Server } from 'socket.io';
import type { JudgeMatchState } from '@wanasatna/shared';
import { JUDGE_GAME_ID } from '@wanasatna/shared';
import { getLoadedGameContent } from '../../../content/index.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { pluginParticipantsMatchShell } from '../../runtime/plugin-participant-invariant.js';
import { startJudgePhaseTimerIfNeeded } from './phase-timer.js';
import { createMatchState } from './state.js';
import { getJudgeState, setJudgeState } from './store.js';

function resolveMatchPlayers(shell: NonNullable<ReturnType<typeof getGameShellByRoomId>>) {
  const participantIds = new Set(
    shell.matchParticipantIds ??
      shell.players.filter((player) => player.isConnected).map((player) => player.id),
  );

  return shell.players.filter((player) => participantIds.has(player.id));
}

export function ensureJudgeMatchState(roomId: string): JudgeMatchState | null {
  const existing = getJudgeState(roomId);
  const shell = getGameShellByRoomId(roomId);

  if (existing) {
    return shell && pluginParticipantsMatchShell(shell, existing.playerIds) ? existing : null;
  }

  if (!shell || shell.gameId !== JUDGE_GAME_ID || shell.phase !== 'PLAYING') {
    return null;
  }

  const content = getLoadedGameContent(JUDGE_GAME_ID);

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
  setJudgeState(roomId, match);
  return match;
}

export function ensureJudgeMatchStateWithTimer(io: Server, roomId: string): JudgeMatchState | null {
  const match = ensureJudgeMatchState(roomId);

  if (match) {
    startJudgePhaseTimerIfNeeded(io, roomId);
  }

  return match;
}
