import type { Server } from 'socket.io';
import type { DrawGuessMatchState, GameShellState } from '@wanasatna/shared';
import { DRAW_GUESS_GAME_ID, DRAW_GUESS_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { getLoadedGameContent } from '../../../content/index.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { finishGameShellForRoom } from '../../game.service.js';
import { cleanupGameShellRuntime } from '../../game.lifecycle.js';
import { broadcastGameShellState } from '../../game.timer.js';
import {
  startDrawGuessPhaseTimerIfNeeded,
  stopDrawGuessPhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import { createRoundState, withRound } from './state.js';
import { deleteDrawGuessState, setDrawGuessState } from './store.js';

function broadcastPhaseChanged(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(DRAW_GUESS_PHASE_CHANGED_EVENT, {});
}

export function endDrawingRound(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
  outcome: {
    guessedCorrectly: boolean;
    correctGuesserPlayerId: string | null;
  },
): DrawGuessMatchState {
  if (match.round.gamePhase !== 'drawing') {
    return match;
  }

  const endedMatch = withRound(match, {
    ...match.round,
    guessedCorrectly: outcome.guessedCorrectly,
    correctGuesserPlayerId: outcome.correctGuesserPlayerId,
    phaseRemainingSeconds: 0,
  });

  return startRoundResults(io, roomId, endedMatch);
}

export function startRoundResults(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
): DrawGuessMatchState {
  const scoredMatch = applyRoundScores(match);
  const nextMatch = withRound(scoredMatch, {
    ...scoredMatch.round,
    gamePhase: 'round-results',
    phaseRemainingSeconds: 0,
  });

  setDrawGuessState(roomId, nextMatch);
  stopDrawGuessPhaseTimer(roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
): DrawGuessMatchState {
  const content = getLoadedGameContent(DRAW_GUESS_GAME_ID);

  if (!content) {
    return match;
  }

  const nextRoundNumber = match.currentRound + 1;
  const nextMatch: DrawGuessMatchState = {
    ...match,
    currentRound: nextRoundNumber,
    matchStatus: 'in-progress',
    round: createRoundState(roomId, match.playerIds, content.settings, nextRoundNumber),
  };

  setDrawGuessState(roomId, nextMatch);
  startDrawGuessPhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

function startMatchCompletedPhase(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
): DrawGuessMatchState {
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

  setDrawGuessState(roomId, nextMatch);
  startDrawGuessPhaseTimerIfNeeded(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): DrawGuessMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  stopDrawGuessPhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function completeMatch(io: Server, roomId: string): void {
  stopDrawGuessPhaseTimer(roomId);
  deleteDrawGuessState(roomId);

  const nextShell = finishGameShellForRoom(roomId);

  if (nextShell) {
    cleanupGameShellRuntime(roomId);
    broadcastGameShellState(io, nextShell);
  }
}
