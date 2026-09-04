import type { Server, Socket } from 'socket.io';
import type { FastAnswerSubmitAnswerPayload, GameActionResponse } from '@wanasatna/shared';
import {
  FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
  FAST_ANSWER_GAME_ID,
  FAST_ANSWER_SUBMIT_ANSWER_EVENT,
  FAST_ANSWER_SYNC_EVENT,
  FAST_ANSWER_WINNER_POINTS,
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
import {
  AnswerAttemptStatus,
  AnswerRejectReason,
  recordAnswerAttempt,
} from '../../runtime/answer-attempt-log.js';
import { isCorrectAnswer, normalizeAnswerText } from './answers.js';
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

function playerDisplayName(
  match: NonNullable<ReturnType<typeof getFastAnswerState>>,
  playerId: string,
): string {
  return match.playerNames[playerId] ?? 'لاعب';
}

async function logFastAnswerAttempt(
  roomId: string,
  playerId: string,
  match: NonNullable<ReturnType<typeof getFastAnswerState>>,
  rawAnswer: string,
  fields: {
    status: AnswerAttemptStatus;
    rejectReason?: AnswerRejectReason | null;
    wasCorrect: boolean | null;
    wasCounted: boolean;
    pointsAwarded?: number;
  },
): Promise<void> {
  await recordAnswerAttempt({
    roomId,
    gameId: FAST_ANSWER_GAME_ID,
    playerId,
    playerDisplayName: playerDisplayName(match, playerId),
    rawAnswer,
    normalizedAnswer: rawAnswer.trim() ? normalizeAnswerText(rawAnswer) || null : null,
    roundIndex: match.currentRound,
    roundId: match.round.roundId,
    turnId: null,
    promptId: match.round.questionId,
    promptText: match.round.question,
    ...fields,
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
    async (payload: FastAnswerSubmitAnswerPayload, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const { roomId, playerId } = socket.data;

      if (isPlayerRecoveryActive(roomId!)) {
        const blockedMatch = getFastAnswerState(roomId!);
        if (blockedMatch) {
          await logFastAnswerAttempt(roomId!, playerId!, blockedMatch, '', {
            status: AnswerAttemptStatus.REJECTED,
            rejectReason: AnswerRejectReason.RECOVERY,
            wasCorrect: null,
            wasCounted: false,
          });
        }
        sendGameResponse(callback, playerRecoveryBlockedError());
        return;
      }

      const shell = getGameShellByRoomId(roomId!);
      const match = getFastAnswerState(roomId!);

      if (!shell || !match || shell.gameId !== FAST_ANSWER_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!isActiveMatchParticipant(shell, playerId!) || !match.playerIds.includes(playerId!)) {
        await logFastAnswerAttempt(roomId!, playerId!, match, '', {
          status: AnswerAttemptStatus.REJECTED,
          rejectReason: AnswerRejectReason.NOT_PARTICIPANT,
          wasCorrect: null,
          wasCounted: false,
        });
        sendGameResponse(callback, notParticipantError());
        return;
      }

      const answer =
        payload && typeof payload === 'object' ? payload.answer : undefined;
      const roundId =
        payload && typeof payload === 'object' ? payload.roundId : undefined;
      const rawAnswer = typeof answer === 'string' ? answer : '';

      if (match.round.gamePhase !== 'question' || match.round.winnerPlayerId !== null) {
        const isCorrect =
          rawAnswer.trim().length > 0 &&
          !isOversizedGameAnswer(rawAnswer) &&
          isCorrectAnswer(rawAnswer, match.round.acceptedAnswers);
        await logFastAnswerAttempt(roomId!, playerId!, match, rawAnswer, {
          status: isCorrect ? AnswerAttemptStatus.CORRECT_NOT_COUNTED : AnswerAttemptStatus.LATE,
          rejectReason: null,
          wasCorrect: isCorrect,
          wasCounted: false,
        });
        sendGameResponse(callback, invalidActionError('لا يمكن إرسال إجابة الآن.'));
        return;
      }

      if (typeof roundId !== 'string' || roundId.length === 0) {
        await logFastAnswerAttempt(roomId!, playerId!, match, rawAnswer, {
          status: AnswerAttemptStatus.REJECTED,
          rejectReason: AnswerRejectReason.VALIDATION,
          wasCorrect: null,
          wasCounted: false,
        });
        sendGameResponse(callback, invalidActionError('معرف الجولة غير صالح.'));
        return;
      }

      if (roundId !== match.round.roundId) {
        const isCorrect =
          rawAnswer.trim().length > 0 &&
          !isOversizedGameAnswer(rawAnswer) &&
          isCorrectAnswer(rawAnswer, match.round.acceptedAnswers);
        await logFastAnswerAttempt(roomId!, playerId!, match, rawAnswer, {
          status: isCorrect ? AnswerAttemptStatus.CORRECT_NOT_COUNTED : AnswerAttemptStatus.LATE,
          rejectReason: null,
          wasCorrect: isCorrect ? true : rawAnswer.trim() ? false : null,
          wasCounted: false,
        });
        sendGameResponse(callback, invalidActionError('انتهت هذه الجولة.'));
        return;
      }

      if (typeof answer !== 'string' || answer.trim().length === 0) {
        await logFastAnswerAttempt(roomId!, playerId!, match, rawAnswer, {
          status: AnswerAttemptStatus.REJECTED,
          rejectReason: AnswerRejectReason.EMPTY,
          wasCorrect: null,
          wasCounted: false,
        });
        sendGameResponse(callback, invalidActionError('الإجابة غير صالحة.'));
        return;
      }

      if (isOversizedGameAnswer(answer)) {
        await logFastAnswerAttempt(roomId!, playerId!, match, answer, {
          status: AnswerAttemptStatus.REJECTED,
          rejectReason: AnswerRejectReason.OVERSIZED,
          wasCorrect: null,
          wasCounted: false,
        });
        sendGameResponse(callback, invalidActionError('الإجابة طويلة جداً.'));
        return;
      }

      if (!isCorrectAnswer(answer, match.round.acceptedAnswers)) {
        await logFastAnswerAttempt(roomId!, playerId!, match, answer, {
          status: AnswerAttemptStatus.WRONG_NOT_COUNTED,
          wasCorrect: false,
          wasCounted: false,
        });
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
        await logFastAnswerAttempt(roomId!, playerId!, match, answer, {
          status:
            claim.reason === 'stale'
              ? AnswerAttemptStatus.LATE
              : AnswerAttemptStatus.CORRECT_NOT_COUNTED,
          wasCorrect: true,
          wasCounted: false,
        });
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

      await logFastAnswerAttempt(roomId!, playerId!, claim.match, answer, {
        status: AnswerAttemptStatus.CORRECT_COUNTED,
        wasCorrect: true,
        wasCounted: true,
        pointsAwarded: FAST_ANSWER_WINNER_POINTS,
      });

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
