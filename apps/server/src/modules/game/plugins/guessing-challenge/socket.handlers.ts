import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  GuessingChallengeSetCategoryPayload,
  GuessingChallengeSubmitFinalGuessPayload,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  GUESSING_CHALLENGE_END_QUESTION_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
  GUESSING_CHALLENGE_SET_CATEGORY_EVENT,
  GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
  GUESSING_CHALLENGE_SYNC_EVENT,
  GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
  GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
  isActiveMatchParticipant,
} from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { getGameSocketContext, sendGameResponse } from '../../game.socket.utils.js';
import {
  isPlayerRecoveryActive,
  playerRecoveryBlockedError,
} from '../../runtime/player-recovery.js';
import { setRoomRoundCategory } from '../../runtime/round-category-store.js';
import { ensureGuessingChallengeMatchStateWithTimer } from './init-match.js';
import {
  broadcastPhaseChanged,
  continueFromRoundResults,
  startRoundResults,
} from './match-lifecycle.js';
import { clearGuessingChallengePhaseTimerRuntime } from './phase-timer.js';
import {
  activateRedCard,
  activateYellowCard,
  applyFinalGuess,
  buildGuessingChallengePlayerView,
  endQuestionTurn,
} from './state.js';
import {
  deleteGuessingChallengeState,
  getGuessingChallengeState,
  setGuessingChallengeState,
} from './store.js';

function gameNotReadyError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: { code: 'INVALID_PHASE', message: 'Game is not ready yet.' },
  };
}

function notParticipantError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: { code: 'NOT_PARTICIPANT', message: 'أنت لست مشاركاً في هذه الجولة.' },
  };
}

function invalidActionError(
  message: string,
): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: { code: 'VALIDATION_ERROR', message },
  };
}

function recoveryBlockedResponse(
  roomId: string,
  callback: ((response: GameActionResponse<unknown>) => void) | undefined,
): boolean {
  if (!isPlayerRecoveryActive(roomId)) {
    return false;
  }

  sendGameResponse(callback, playerRecoveryBlockedError());
  return true;
}

function clearGuessingChallengeRuntime(roomId: string): void {
  clearGuessingChallengePhaseTimerRuntime(roomId);
  deleteGuessingChallengeState(roomId);
}

function respondWithView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
  extra?: Record<string, unknown>,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getGuessingChallengeState(roomId);

  if (!shell || !match) {
    sendGameResponse(callback, gameNotReadyError());
    return;
  }

  sendGameResponse(callback, {
    success: true,
    data: {
      view: buildGuessingChallengePlayerView(match, playerId, shell),
      ...extra,
    },
  });
}

export function registerGuessingChallengeSocketHandlers(io: Server, socket: Socket): void {
  socket.on(GUESSING_CHALLENGE_SYNC_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;
    const shell = getGameShellByRoomId(roomId!);

    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (shell.phase === 'PLAYING') {
      ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
    }

    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(GUESSING_CHALLENGE_END_QUESTION_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    const shell = getGameShellByRoomId(roomId!);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (!isActiveMatchParticipant(shell, playerId!)) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
    const match = getGuessingChallengeState(roomId!);
    if (!match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    const result = endQuestionTurn(match, playerId!);
    if (!result.ok) {
      sendGameResponse(callback, invalidActionError(result.message));
      return;
    }

    setGuessingChallengeState(roomId!, result.match);
    broadcastPhaseChanged(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(
    GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
    (payload: GuessingChallengeSubmitFinalGuessPayload, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const { roomId, playerId } = socket.data;

      if (recoveryBlockedResponse(roomId!, callback)) {
        return;
      }

      const shell = getGameShellByRoomId(roomId!);
      if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!isActiveMatchParticipant(shell, playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      ensureGuessingChallengeMatchStateWithTimer(io, roomId!);

      const result = applyFinalGuess(
        () => getGuessingChallengeState(roomId!),
        (next) => setGuessingChallengeState(roomId!, next),
        playerId!,
        typeof payload?.guess === 'string' ? payload.guess : '',
      );

      if (!result.accepted) {
        sendGameResponse(callback, invalidActionError(result.message));
        return;
      }

      if (result.correct) {
        startRoundResults(io, roomId!, result.match);
        respondWithView(callback, roomId!, playerId!, { guessCorrect: true });
        return;
      }

      broadcastPhaseChanged(io, roomId!);
      respondWithView(callback, roomId!, playerId!, {
        guessCorrect: false,
        guessFeedback: 'إجابة غير صحيحة',
      });
    },
  );

  socket.on(GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    const shell = getGameShellByRoomId(roomId!);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (!isActiveMatchParticipant(shell, playerId!)) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
    const match = getGuessingChallengeState(roomId!);
    if (!match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    const result = activateYellowCard(match, playerId!);
    if (!result.ok) {
      sendGameResponse(callback, invalidActionError(result.message));
      return;
    }

    setGuessingChallengeState(roomId!, result.match);
    broadcastPhaseChanged(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(GUESSING_CHALLENGE_USE_RED_CARD_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    const shell = getGameShellByRoomId(roomId!);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (!isActiveMatchParticipant(shell, playerId!)) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    ensureGuessingChallengeMatchStateWithTimer(io, roomId!);
    const match = getGuessingChallengeState(roomId!);
    if (!match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    const result = activateRedCard(match, playerId!);
    if (!result.ok) {
      sendGameResponse(callback, invalidActionError(result.message));
      return;
    }

    setGuessingChallengeState(roomId!, result.match);
    broadcastPhaseChanged(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    const shell = getGameShellByRoomId(roomId!);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID || shell.phase !== 'PLAYING') {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    const match = getGuessingChallengeState(roomId!);
    if (!match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    const next = continueFromRoundResults(io, roomId!, match, shell, playerId!);
    respondWithView(callback, roomId!, playerId!);

    if (next.round.gamePhase === 'match-completed') {
      io.to(getRoomChannel(roomId!)).emit(GUESSING_CHALLENGE_PHASE_CHANGED_EVENT, {});
    }
  });

  socket.on(
    GUESSING_CHALLENGE_SET_CATEGORY_EVENT,
    (payload: GuessingChallengeSetCategoryPayload, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const { roomId, playerId } = socket.data;
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (shell.hostPlayerId !== playerId) {
        sendGameResponse(callback, invalidActionError('المضيف فقط يختار الفئة.'));
        return;
      }

      setRoomRoundCategory(roomId!, payload?.categoryId ?? null);
      respondWithView(callback, roomId!, playerId!);
    },
  );

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) {
      return;
    }

    const shell = getGameShellByRoomId(roomId);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID) {
      return;
    }

    // Runtime cleanup is owned by shared shell/end-game paths.
    void clearGuessingChallengeRuntime;
  });
}
