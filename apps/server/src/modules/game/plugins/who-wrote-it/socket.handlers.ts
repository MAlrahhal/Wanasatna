import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  WhoWroteItSetCategoryPayload,
  WhoWroteItSubmitAnswerPayload,
  WhoWroteItSubmitOwnerGuessPayload,
} from '@wanasatna/shared';
import {
  WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
  WHO_WROTE_IT_GAME_ID,
  WHO_WROTE_IT_PHASE_CHANGED_EVENT,
  WHO_WROTE_IT_SET_CATEGORY_EVENT,
  WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
  WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
  WHO_WROTE_IT_SYNC_EVENT,
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
import { validateSubmittedAnswer } from './answers.js';
import { ensureWhoWroteItMatchStateWithTimer } from './init-match.js';
import {
  continueFromRoundResults,
  startRoundResults,
  transitionToGuessing,
} from './match-lifecycle.js';
import { clearWhoWroteItPhaseTimerRuntime } from './phase-timer.js';
import {
  advanceGlobalAnswerOrComplete,
  allConnectedHaveAnswered,
  allRequiredHaveGuessedCurrent,
  applyOwnerGuess,
  buildWhoWroteItPlayerView,
  findAnswerById,
  findAnswerByPlayerId,
  getCurrentAnswerId,
  getEligibleOwnerOptions,
  getPlayerGuessMap,
  submitAnswerToMatch,
} from './state.js';
import {
  deleteWhoWroteItState,
  getWhoWroteItState,
  setWhoWroteItState,
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

function clearWhoWroteItRuntime(roomId: string): void {
  clearWhoWroteItPhaseTimerRuntime(roomId);
  deleteWhoWroteItState(roomId);
}

function respondWithView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getWhoWroteItState(roomId);

  if (!shell || !match) {
    sendGameResponse(callback, gameNotReadyError());
    return;
  }

  sendGameResponse(callback, {
    success: true,
    data: { view: buildWhoWroteItPlayerView(match, playerId, shell) },
  });
}

export function registerWhoWroteItSocketHandlers(io: Server, socket: Socket): void {
  socket.on(WHO_WROTE_IT_SYNC_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;
    const shell = getGameShellByRoomId(roomId!);

    if (!shell || shell.gameId !== WHO_WROTE_IT_GAME_ID) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (shell.phase === 'PLAYING') {
      ensureWhoWroteItMatchStateWithTimer(io, roomId!);
    }

    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(
    WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
    (payload: WhoWroteItSubmitAnswerPayload, callback) => {
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
      let match = getWhoWroteItState(roomId!);

      if (!shell || !match || shell.gameId !== WHO_WROTE_IT_GAME_ID) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!isActiveMatchParticipant(shell, playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      if (match.round.gamePhase !== 'answering') {
        sendGameResponse(callback, invalidActionError('انتهت مرحلة الإجابات.'));
        return;
      }

      if (findAnswerByPlayerId(match, playerId!)) {
        sendGameResponse(callback, invalidActionError('تم إرسال إجابتك مسبقاً.'));
        return;
      }

      const validated = validateSubmittedAnswer(payload?.answer);

      if (!validated.ok) {
        sendGameResponse(callback, invalidActionError(validated.message));
        return;
      }

      match = submitAnswerToMatch(match, playerId!, validated.text);
      setWhoWroteItState(roomId!, match);

      if (allConnectedHaveAnswered(match, shell)) {
        match = transitionToGuessing(io, roomId!, match);
      } else {
        io.to(getRoomChannel(roomId!)).emit(WHO_WROTE_IT_PHASE_CHANGED_EVENT, {});
      }

      respondWithView(callback, roomId!, playerId!);
    },
  );

  socket.on(
    WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
    (payload: WhoWroteItSubmitOwnerGuessPayload, callback) => {
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
      let match = getWhoWroteItState(roomId!);

      if (!shell || !match || shell.gameId !== WHO_WROTE_IT_GAME_ID) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!isActiveMatchParticipant(shell, playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      if (match.round.gamePhase !== 'guessing') {
        sendGameResponse(callback, invalidActionError('ليست مرحلة التخمين.'));
        return;
      }

      const answerId =
        payload && typeof payload === 'object' && typeof payload.answerId === 'string'
          ? payload.answerId
          : '';
      const ownerPlayerId =
        payload && typeof payload === 'object' && typeof payload.ownerPlayerId === 'string'
          ? payload.ownerPlayerId
          : '';

      const expectedAnswerId = getCurrentAnswerId(match);

      if (!answerId || !expectedAnswerId || answerId !== expectedAnswerId) {
        sendGameResponse(callback, invalidActionError('هذه الإجابة غير متاحة للتخمين الآن.'));
        return;
      }

      const answer = findAnswerById(match, answerId);

      if (!answer) {
        sendGameResponse(callback, invalidActionError('الإجابة غير موجودة.'));
        return;
      }

      if (answer.ownerPlayerId === playerId) {
        sendGameResponse(callback, invalidActionError('لا يمكن تخمين إجابتك الخاصة.'));
        return;
      }

      if (getPlayerGuessMap(match, playerId!)[answerId]) {
        sendGameResponse(callback, invalidActionError('تم تخمين هذه الإجابة مسبقاً.'));
        return;
      }

      if (ownerPlayerId === playerId) {
        sendGameResponse(callback, invalidActionError('لا يمكن اختيار نفسك.'));
        return;
      }

      const eligible = getEligibleOwnerOptions(match, playerId!).some(
        (option) => option.playerId === ownerPlayerId,
      );

      if (!eligible) {
        sendGameResponse(callback, invalidActionError('اللاعب المختار غير متاح.'));
        return;
      }

      match = applyOwnerGuess(match, playerId!, answerId, ownerPlayerId);
      setWhoWroteItState(roomId!, match);

      if (allRequiredHaveGuessedCurrent(match, shell)) {
        const advanced = advanceGlobalAnswerOrComplete(match);

        if (advanced.completed) {
          match = startRoundResults(io, roomId!, advanced.match);
        } else {
          match = advanced.match;
          setWhoWroteItState(roomId!, match);
          io.to(getRoomChannel(roomId!)).emit(WHO_WROTE_IT_PHASE_CHANGED_EVENT, {});
        }
      } else {
        io.to(getRoomChannel(roomId!)).emit(WHO_WROTE_IT_PHASE_CHANGED_EVENT, {});
      }

      respondWithView(callback, roomId!, playerId!);
    },
  );

  socket.on(WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT, (_payload: unknown, callback) => {
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
    const match = getWhoWroteItState(roomId!);

    if (!shell || !match || shell.gameId !== WHO_WROTE_IT_GAME_ID) {
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
    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(
    WHO_WROTE_IT_SET_CATEGORY_EVENT,
    (payload: WhoWroteItSetCategoryPayload, callback) => {
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
      const match = getWhoWroteItState(roomId!);

      if (!shell || !match || shell.gameId !== WHO_WROTE_IT_GAME_ID) {
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

      if (match.round.gamePhase !== 'round-results') {
        sendGameResponse(callback, invalidActionError('يمكن تغيير الفئة أثناء نتائج الجولة فقط.'));
        return;
      }

      const categoryId =
        payload && typeof payload === 'object' ? payload.categoryId : null;

      setRoomRoundCategory(
        roomId!,
        typeof categoryId === 'string' || categoryId === null ? categoryId : null,
      );

      io.to(getRoomChannel(roomId!)).emit(WHO_WROTE_IT_PHASE_CHANGED_EVENT, {});
      respondWithView(callback, roomId!, playerId!);
    },
  );
}

export { clearWhoWroteItRuntime };
