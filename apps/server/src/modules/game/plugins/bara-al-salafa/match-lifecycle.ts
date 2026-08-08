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
import { getRoomChannel } from '../../../room/room.utils.js';
import { getLoadedGameContent } from '../../../content/index.js';
import { finishGameShellForRoom } from '../../game.service.js';
import { cleanupGameShellRuntime } from '../../game.lifecycle.js';
import { broadcastGameShellState } from '../../game.timer.js';
import { resolveEnabledCategoryFilter } from '../../runtime/round-category-store.js';
import { applyRoundScores } from './scoring.js';
import {
  createRoundState,
  syncMatchPlayersFromShell,
  withRound,
} from './round-state.js';
import { deleteBaraAlSalafaState, setBaraAlSalafaState } from './store.js';
import { startPhaseTimerIfNeeded, stopPhaseTimer } from './phase-timer.js';

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
  );

  const nextMatch: BaraAlSalafaMatchState = {
    ...syncedMatch,
    currentRound: nextRoundNumber,
    matchStatus: 'in-progress',
    round: nextRound,
  };

  setBaraAlSalafaState(roomId, nextMatch);
  startPhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function startRoundResultsPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
): BaraAlSalafaMatchState {
  const scoredMatch = applyRoundScores(match);
  const nextMatch = withRound(scoredMatch, {
    ...scoredMatch.round,
    gamePhase: 'round-results',
    phaseRemainingSeconds: 0,
  });

  setBaraAlSalafaState(roomId, nextMatch);
  stopPhaseTimer(roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function completeRoundResultsPhase(
  io: Server,
  roomId: string,
  match: BaraAlSalafaMatchState,
  shell: GameShellState,
): BaraAlSalafaMatchState {
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
      phaseRemainingSeconds: timedPhaseDurations.matchResults(),
    },
  );

  setBaraAlSalafaState(roomId, nextMatch);
  startPhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function completeMatchCompletedPhase(io: Server, roomId: string): void {
  stopPhaseTimer(roomId);
  deleteBaraAlSalafaState(roomId);

  const nextShell = finishGameShellForRoom(roomId);

  if (nextShell) {
    cleanupGameShellRuntime(roomId);
    broadcastGameShellState(io, nextShell);
  }
}
