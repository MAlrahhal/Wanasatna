import type { Server, Socket } from 'socket.io';
import type { FastAnswerSubmitAnswerPayload, GameActionResponse } from '@wanasatna/shared';
import {
  FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_SUBMIT_ANSWER_EVENT,
  FAST_ANSWER_SYNC_EVENT,
  isActiveMatchParticipant,
} from '@wanasatna/shared';
import { getGameShellByRoomId } from '../../game.service.js';
import {
  getGameSocketContext,
  rejectIfGameSyncRateLimited,
  sendGameResponse,
} from '../../game.socket.utils.js';
import {
  isPlayerRecoveryActive,
  playerRecoveryBlockedError,
} from '../../runtime/player-recovery.js';
import { isOversizedGameAnswer } from '../../runtime/game-answer-text.js';
import { isCorrectAnswer } from './answers.js';
import { ensureFastAnswerMatchStateWithTimer } from './init-match.js';
import { continueFromRoundResults, finalizeQuestionRound } from './match-lifecycle.js';
import { clearFastAnswerPhaseTimerRuntime } from './phase-timer.js';
import { buildFastAnswerPlayerView, tryAcceptCorrectAnswer } from './state.js';
import {
  deleteFastAnswerState,
  getFastAnswerState,
  setFastAnswerState,
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

function clearFastAnswerRuntime(roomId: string): void {
  clearFastAnswerPhaseTimerRuntime(roomId);
  deleteFastAnswerState(roomId);
}

function respondWithView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getFastAnswerState(roomId);

  if (!shell || !match) {
    sendGameResponse(callback, gameNotReadyError());
    return;
  }

  sendGameResponse(callback, {
    success: true,
    data: { view: buildFastAnswerPlayerView(match, playerId, shell) },
  });
}

export function registerFastAnswerSocketHandlers(io: Server, socket: Socket): void {
  socket.on(FAST_ANSWER_SYNC_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    if (rejectIfGameSyncRateLimited(socket, callback)) {
      return;
    }

    const { roomId, playerId } = socket.data;
    const shell = getGameShellByRoomId(roomId!);

    if (!shell || shell.gameId !== FAST_ANSWER_GAME_ID) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (shell.phase === 'PLAYING') {
      ensureFastAnswerMatchStateWithTimer(io, roomId!);
    }

    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(
    FAST_ANSWER_SUBMIT_ANSWER_EVENT,
    (payload: FastAnswerSubmitAnswerPayload, callback) => {
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
      const match = getFastAnswerState(roomId!);

      if (!shell || !match || shell.gameId !== FAST_ANSWER_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!isActiveMatchParticipant(shell, playerId!) || !match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      if (match.round.gamePhase !== 'question' || match.round.winnerPlayerId !== null) {
        sendGameResponse(callback, invalidActionError('لا يمكن إرسال إجابة الآن.'));
        return;
      }

      const answer =
        payload && typeof payload === 'object' ? payload.answer : undefined;
      const roundId =
        payload && typeof payload === 'object' ? payload.roundId : undefined;

      if (typeof roundId !== 'string' || roundId.length === 0) {
        sendGameResponse(callback, invalidActionError('معرف الجولة غير صالح.'));
        return;
      }

      if (roundId !== match.round.roundId) {
        sendGameResponse(callback, invalidActionError('انتهت هذه الجولة.'));
        return;
      }

      if (typeof answer !== 'string' || answer.trim().length === 0) {
        sendGameResponse(callback, invalidActionError('الإجابة غير صالحة.'));
        return;
      }

      if (isOversizedGameAnswer(answer)) {
        sendGameResponse(callback, invalidActionError('الإجابة طويلة جداً.'));
        return;
      }

      if (!isCorrectAnswer(answer, match.round.acceptedAnswers)) {
        sendGameResponse(callback, {
          success: true,
          data: {
            correct: false,
            view: buildFastAnswerPlayerView(match, playerId!, shell),
          },
        });
        return;
      }

      const claim = tryAcceptCorrectAnswer(
        () => getFastAnswerState(roomId!),
        (next) => setFastAnswerState(roomId!, next),
        playerId!,
        roundId,
      );

      if (!claim.accepted || !claim.match) {
        sendGameResponse(callback, {
          success: true,
          data: {
            correct: false,
            view: buildFastAnswerPlayerView(
              getFastAnswerState(roomId!) ?? match,
              playerId!,
              shell,
            ),
          },
        });
        return;
      }

      const finalized = finalizeQuestionRound(io, roomId!, claim.match, {
        winnerPlayerId: playerId!,
        timedOut: false,
      });

      sendGameResponse(callback, {
        success: true,
        data: {
          correct: true,
          view: buildFastAnswerPlayerView(finalized, playerId!, shell),
        },
      });
    },
  );

  socket.on(FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT, (_payload: unknown, callback) => {
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
    const match = getFastAnswerState(roomId!);

    if (!shell || !match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (shell.hostPlayerId !== playerId) {
      sendGameResponse(callback, {
        success: false,
        error: { code: 'NOT_HOST', message: 'هذا الإجراء متاح للمضيف فقط.' },
      });
      return;
    }

    continueFromRoundResults(io, roomId!, match, shell, playerId!);

    if (getFastAnswerState(roomId!)) {
      respondWithView(callback, roomId!, playerId!);
      return;
    }

    sendGameResponse(callback, { success: true, data: {} });
  });
}

export { clearFastAnswerRuntime };
