import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  GuessingChallengeLookPayload,
  GuessingChallengeMode,
  GuessingChallengeSetCategoryPayload,
  GuessingChallengeSubmitFinalGuessPayload,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  GUESSING_CHALLENGE_END_QUESTION_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
  GUESSING_CHALLENGE_LOOK_EVENT,
  GUESSING_CHALLENGE_LOOK_UPDATE_EVENT,
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
import {
  clearGuessingChallengeRoomMode,
  setGuessingChallengeRoomMode,
} from './mode-store.js';
import { clearGuessingChallengePhaseTimerRuntime } from './phase-timer.js';
import {
  applyFinalGuess,
  applyLookDirection,
  buildGuessingChallengePlayerView,
  clearLookThrottleForRoom,
  confirmSpecialCard,
  endQuestionTurn,
  resetPlayerLook,
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
  clearLookThrottleForRoom(roomId);
  clearGuessingChallengeRoomMode(roomId);
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

export function applyGuessingChallengeLobbySettings(
  roomId: string,
  settingsInput: unknown,
): { success: true } | { success: false; error: string } {
  if (!settingsInput || typeof settingsInput !== 'object') {
    clearGuessingChallengeRoomMode(roomId);
    return { success: true };
  }

  const mode = (settingsInput as { mode?: unknown }).mode;
  if (mode === undefined) {
    clearGuessingChallengeRoomMode(roomId);
    return { success: true };
  }

  if (mode !== '1v1' && mode !== '2v2') {
    return { success: false, error: 'وضع اللعب غير صالح.' };
  }

  setGuessingChallengeRoomMode(roomId, mode as GuessingChallengeMode);
  return { success: true };
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

  // USE_YELLOW means "confirm yellow-card use" (team confirmation in 2v2).
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

    const result = confirmSpecialCard(
      () => getGuessingChallengeState(roomId!),
      (next) => setGuessingChallengeState(roomId!, next),
      shell,
      playerId!,
      'yellow',
    );

    if (!result.ok) {
      sendGameResponse(callback, invalidActionError(result.message));
      return;
    }

    broadcastPhaseChanged(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
  });

  // USE_RED means "confirm red-card use" (team confirmation in 2v2).
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

    const result = confirmSpecialCard(
      () => getGuessingChallengeState(roomId!),
      (next) => setGuessingChallengeState(roomId!, next),
      shell,
      playerId!,
      'red',
    );

    if (!result.ok) {
      sendGameResponse(callback, invalidActionError(result.message));
      return;
    }

    broadcastPhaseChanged(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(
    GUESSING_CHALLENGE_LOOK_EVENT,
    (payload: GuessingChallengeLookPayload, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const { roomId, playerId } = socket.data;
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

      const applied = applyLookDirection(
        match,
        roomId!,
        playerId!,
        typeof payload?.yaw === 'number' ? payload.yaw : 0,
        typeof payload?.pitch === 'number' ? payload.pitch : 0,
      );

      if (!applied) {
        sendGameResponse(callback, { success: true, data: { throttled: true } });
        return;
      }

      setGuessingChallengeState(roomId!, applied.match);
      io.to(getRoomChannel(roomId!)).emit(GUESSING_CHALLENGE_LOOK_UPDATE_EVENT, {
        playerId: playerId!,
        yaw: applied.yaw,
        pitch: applied.pitch,
      });
      sendGameResponse(callback, {
        success: true,
        data: { yaw: applied.yaw, pitch: applied.pitch },
      });
    },
  );

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
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId) {
      return;
    }

    const shell = getGameShellByRoomId(roomId);
    if (!shell || shell.gameId !== GUESSING_CHALLENGE_GAME_ID) {
      return;
    }

    if (playerId) {
      const match = getGuessingChallengeState(roomId);
      if (match) {
        setGuessingChallengeState(roomId, resetPlayerLook(match, playerId));
        io.to(getRoomChannel(roomId)).emit(GUESSING_CHALLENGE_LOOK_UPDATE_EVENT, {
          playerId,
          yaw: 0,
          pitch: 0,
        });
      }
    }

    // Runtime cleanup is owned by shared shell/end-game paths.
    void clearGuessingChallengeRuntime;
  });
}

export { clearGuessingChallengeRuntime };
