import type { Server, Socket } from 'socket.io';
import type {
  GameActionResponse,
  JudgeSelectWinnerPayload,
  JudgeSubmitAnswerPayload,
} from '@wanasatna/shared';
import {
  JUDGE_CONTINUE_ROUND_RESULTS_EVENT,
  JUDGE_GAME_ID,
  JUDGE_PHASE_CHANGED_EVENT,
  JUDGE_SELECT_WINNER_EVENT,
  JUDGE_SUBMIT_ANSWER_EVENT,
  JUDGE_SYNC_EVENT,
  isActiveMatchParticipant,
} from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
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
import { validateSubmittedAnswer } from './answers.js';
import { ensureJudgeMatchStateWithTimer } from './init-match.js';
import {
  continueFromRoundResults,
  maybeAdvanceAnswering,
  startRoundResults,
} from './match-lifecycle.js';
import { clearJudgePhaseTimerRuntime } from './phase-timer.js';
import {
  buildJudgePlayerView,
  findAnswerByPlayerId,
  isDeparted,
  submitAnswerToMatch,
  trySelectWinner,
} from './state.js';
import { deleteJudgeState, getJudgeState, setJudgeState } from './store.js';

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

function clearJudgeRuntime(roomId: string): void {
  clearJudgePhaseTimerRuntime(roomId);
  deleteJudgeState(roomId);
}

function respondWithView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getJudgeState(roomId);

  if (!shell || !match) {
    sendGameResponse(callback, gameNotReadyError());
    return;
  }

  sendGameResponse(callback, {
    success: true,
    data: { view: buildJudgePlayerView(match, playerId, shell) },
  });
}

function readRoundId(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'roundId' in payload) {
    const roundId = (payload as { roundId?: unknown }).roundId;
    return typeof roundId === 'string' ? roundId : '';
  }

  return '';
}

export function registerJudgeSocketHandlers(io: Server, socket: Socket): void {
  socket.on(JUDGE_SYNC_EVENT, (_payload: unknown, callback) => {
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

    if (!shell || shell.gameId !== JUDGE_GAME_ID) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (shell.phase === 'PLAYING') {
      ensureJudgeMatchStateWithTimer(io, roomId!);
    }

    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(JUDGE_SUBMIT_ANSWER_EVENT, (payload: JudgeSubmitAnswerPayload, callback) => {
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
    let match = getJudgeState(roomId!);

    if (!shell || !match || shell.gameId !== JUDGE_GAME_ID) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (!isActiveMatchParticipant(shell, playerId!) || isDeparted(match, playerId!)) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    if (match.round.gamePhase !== 'answering') {
      sendGameResponse(callback, invalidActionError('انتهت مرحلة الإجابات.'));
      return;
    }

    if (readRoundId(payload) !== match.round.roundId) {
      sendGameResponse(callback, invalidActionError('انتهت هذه الجولة.'));
      return;
    }

    if (match.round.judgePlayerId === playerId) {
      sendGameResponse(callback, invalidActionError('القاضي لا يرسل إجابة.'));
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
    setJudgeState(roomId!, match);

    const advanced = maybeAdvanceAnswering(io, roomId!, match, shell);
    if (advanced === match) {
      io.to(getRoomChannel(roomId!)).emit(JUDGE_PHASE_CHANGED_EVENT, {});
    }

    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(JUDGE_SELECT_WINNER_EVENT, (payload: JudgeSelectWinnerPayload, callback) => {
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
    const existing = getJudgeState(roomId!);

    if (!shell || !existing || shell.gameId !== JUDGE_GAME_ID) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (!isActiveMatchParticipant(shell, playerId!) || isDeparted(existing, playerId!)) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    if (existing.round.judgePlayerId !== playerId) {
      sendGameResponse(callback, {
        success: false,
        error: { code: 'NOT_HOST', message: 'هذا الإجراء متاح للقاضي فقط.' },
      });
      return;
    }

    if (existing.round.gamePhase !== 'judging') {
      sendGameResponse(callback, invalidActionError('انتهت مرحلة التحكيم.'));
      return;
    }

    if (readRoundId(payload) !== existing.round.roundId) {
      sendGameResponse(callback, invalidActionError('انتهت هذه الجولة.'));
      return;
    }

    const answerId =
      payload && typeof payload === 'object' && typeof payload.answerId === 'string'
        ? payload.answerId
        : '';

    if (!answerId) {
      sendGameResponse(callback, invalidActionError('اختر إجابة صحيحة.'));
      return;
    }

    const claim = trySelectWinner(
      () => getJudgeState(roomId!),
      (next) => setJudgeState(roomId!, next),
      playerId!,
      answerId,
    );

    if (!claim.accepted || !claim.match) {
      sendGameResponse(callback, invalidActionError('تعذر اختيار الإجابة.'));
      return;
    }

    startRoundResults(io, roomId!, claim.match);
    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(JUDGE_CONTINUE_ROUND_RESULTS_EVENT, (_payload: unknown, callback) => {
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
    const match = getJudgeState(roomId!);

    if (!shell || !match || shell.gameId !== JUDGE_GAME_ID) {
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

    if (getJudgeState(roomId!)) {
      respondWithView(callback, roomId!, playerId!);
      return;
    }

    sendGameResponse(callback, { success: true, data: {} });
  });
}

export { clearJudgeRuntime };
