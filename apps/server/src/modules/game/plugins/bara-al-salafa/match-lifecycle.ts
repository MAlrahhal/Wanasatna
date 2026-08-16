import type { Server } from 'socket.io';
import type {
  BaraAlSalafaMatchState,
  GameContentBundle,
  GameContentSettings,
  GameShellState,
} from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_GAME_ID,
  BARA_AL_SALAFA_PHASE_CHANGED_EVENT,
} from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { timedPhaseClock } from '../../runtime/phase-deadline.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getLoadedGameContent } from '../../../content/index.js';
import { deleteGameShell, getGameShellByRoomId } from '../../game.service.js';
import { cleanupGameShellRuntime, navigateRoomToLobby } from '../../game.lifecycle.js';
import { resolveEnabledCategoryFilter } from '../../runtime/round-category-store.js';
import { applyRoundScores } from './scoring.js';
import {
  createRoundState,
  syncMatchPlayersFromShell,
  withRound,
} from './round-state.js';
import { deleteBaraAlSalafaState, setBaraAlSalafaState } from './store.js';
import {
  clearPhaseTimerRuntime,
  restartPhaseTimer,
  stopPhaseTimer,
} from './phase-timer.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(BARA_AL_SALAFA_PHASE_CHANGED_EVENT, {});
}

export function startNextRound(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
  bundle: GameContentBundle,
  settings: GameContentSettings,
): BaraAlSalafaMatchState {
  const syncedMatch = syncMatchPlayersFromShell(match, shell.players);
  const nextRoundNumber = syncedMatch.currentRound + 1;
  const nextRound = createRoundState(
    shell.players.filter((player) => syncedMatch.playerIds.includes(player.id)),
    bundle,
    settings,
    resolveEnabledCategoryFilter(roomId),
    syncedMatch.usedWordTexts,
  );

  const nextMatch: BaraAlSalafaMatchState = {
    ...syncedMatch,
    currentRound: nextRoundNumber,
    matchStatus: 'in-progress',
    usedWordTexts: [...syncedMatch.usedWordTexts, nextRound.word],
    round: nextRound,
  };

  setBaraAlSalafaState(roomId, nextMatch);
  restartPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function startRoundResultsPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase === 'round-results') {
    return match;
  }

  const scoredMatch = applyRoundScores(match);
  const nextMatch = withRound(scoredMatch, {
    ...scoredMatch.round,
    gamePhase: 'round-results',
    ...timedPhaseClock(scoredMatch.round.roundResultsDurationSeconds),
  });

  setBaraAlSalafaState(roomId, nextMatch);
  restartPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function completeRoundResultsPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
): BaraAlSalafaMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  const content = getLoadedGameContent(BARA_AL_SALAFA_GAME_ID);

  if (!content) {
    return match;
  }

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match, shell, content.bundle, content.settings);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function startMatchCompletedPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  const nextMatch = withRound(
    {
      ...match,
      matchStatus: 'completed',
    },
    {
      ...match.round,
      gamePhase: 'match-completed',
      ...timedPhaseClock(timedPhaseDurations.matchResults()),
    },
  );

  setBaraAlSalafaState(roomId, nextMatch);
  restartPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function completeMatchCompletedPhase(io: Server, roomId: string): void {
  clearPhaseTimerRuntime(roomId);
  deleteBaraAlSalafaState(roomId);

  // Must delete the shell (not leave FINISHED). navigateRoomToLobby alone leaves a
  // stale shell Map entry → next start-from-lobby fails with SHELL_ALREADY_EXISTS.
  const shell = getGameShellByRoomId(roomId);
  if (!shell) {
    return;
  }

  cleanupGameShellRuntime(roomId);
  deleteGameShell(roomId);
  navigateRoomToLobby(io, roomId);
}

export function cleanupBaraAlSalafaRuntime(roomId: string): void {
  clearPhaseTimerRuntime(roomId);
  deleteBaraAlSalafaState(roomId);
  stopPhaseTimer(roomId);
}
