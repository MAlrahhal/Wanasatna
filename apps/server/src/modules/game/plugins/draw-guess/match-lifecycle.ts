import type { Server } from 'socket.io';
import type { DrawGuessMatchState, GameShellState } from '@wanasatna/shared';
import { DRAW_GUESS_GAME_ID, DRAW_GUESS_PHASE_CHANGED_EVENT } from '@wanasatna/shared';
import { timedPhaseDurations } from '../../../../config/test-timers.js';
import { getLoadedGameContent } from '../../../content/index.js';
import { getRoomChannel } from '../../../room/room.utils.js';
import { deleteGameShell, getGameShellByRoomId } from '../../game.service.js';
import { cleanupGameShellRuntime, navigateRoomToLobby } from '../../game.lifecycle.js';
import {
  clearDrawGuessPhaseTimerRuntime,
  restartDrawGuessPhaseTimer,
  stopDrawGuessPhaseTimer,
} from './phase-timer.js';
import { applyRoundScores } from './scoring.js';
import { createRoundState, getConnectedParticipantIds, withRound } from './state.js';
import { deleteDrawGuessState, setDrawGuessState } from './store.js';
import { clearDrawGuessRoomDrawerSettings } from './drawer-mode-store.js';

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
    phaseRemainingSeconds: timedPhaseDurations.drawGuessRoundResults(),
  });

  setDrawGuessState(roomId, nextMatch);
  restartDrawGuessPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

function startNextRound(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
  shell: GameShellState,
): DrawGuessMatchState {
  const content = getLoadedGameContent(DRAW_GUESS_GAME_ID);

  if (!content) {
    return match;
  }

  const nextRoundNumber = match.currentRound + 1;
  const connectedPlayerIds = getConnectedParticipantIds(shell, match);
  const { round, usedWordTexts } = createRoundState(
    roomId,
    match,
    nextRoundNumber,
    connectedPlayerIds,
  );

  const nextMatch: DrawGuessMatchState = {
    ...match,
    currentRound: nextRoundNumber,
    matchStatus: 'in-progress',
    usedWordTexts,
    round,
  };

  setDrawGuessState(roomId, nextMatch);
  restartDrawGuessPhaseTimer(io, roomId);
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
  restartDrawGuessPhaseTimer(io, roomId);
  broadcastPhaseChanged(io, roomId);

  return nextMatch;
}

export function advanceFromRoundResults(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
  shell: GameShellState,
): DrawGuessMatchState {
  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  stopDrawGuessPhaseTimer(roomId);

  if (match.currentRound < match.totalRounds) {
    return startNextRound(io, roomId, match, shell);
  }

  return startMatchCompletedPhase(io, roomId, match);
}

export function continueFromRoundResults(
  io: Server,
  roomId: string,
  match: DrawGuessMatchState,
  shell: GameShellState,
  hostPlayerId: string,
): DrawGuessMatchState {
  if (shell.hostPlayerId !== hostPlayerId) {
    return match;
  }

  if (match.round.gamePhase === 'match-completed') {
    completeMatch(io, roomId);
    return match;
  }

  if (match.round.gamePhase !== 'round-results') {
    return match;
  }

  return advanceFromRoundResults(io, roomId, match, shell);
}

export function completeMatch(io: Server, roomId: string): void {
  clearDrawGuessPhaseTimerRuntime(roomId);
  deleteDrawGuessState(roomId);
  clearDrawGuessRoomDrawerSettings(roomId);

  // Same invariant as bara: lobby return must delete the shell, not leave FINISHED.
  const shell = getGameShellByRoomId(roomId);
  if (!shell) {
    return;
  }

  cleanupGameShellRuntime(roomId);
  deleteGameShell(roomId);
  navigateRoomToLobby(io, roomId);
}
