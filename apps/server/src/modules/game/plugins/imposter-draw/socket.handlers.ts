import type { Server, Socket } from 'socket.io';
import type {
  DrawStroke,
  GameActionResponse,
  ImposterDrawSubmitImageGuessPayload,
  ImposterDrawSubmitVotePayload,
} from '@wanasatna/shared';
import {
  IMPOSTER_DRAW_CANVAS_UPDATED_EVENT,
  IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT,
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_STROKE_EVENT,
  IMPOSTER_DRAW_STROKE_POINTS_EVENT,
  IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT,
  IMPOSTER_DRAW_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  IMPOSTER_DRAW_SUBMIT_VOTE_EVENT,
  IMPOSTER_DRAW_SYNC_EVENT,
  IMPOSTER_DRAW_UNDO_EVENT,
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
import {
  IMPOSTER_DRAW_BOARD_LIMITS,
  processStrokeCommand,
  processStrokePointsCommand,
} from '../../runtime/drawing-strokes.js';
import { ensureImposterDrawMatchStateWithTimer } from './init-match.js';
import {
  applyBriefingAcknowledgement,
  applyImageGuessSubmission,
  applyVoteSubmission,
  continueFromRoundResults,
} from './match-lifecycle.js';
import { clearImposterDrawPhaseTimerRuntime } from './phase-timer.js';
import {
  buildImposterDrawPlayerView,
  buildImposterDrawSpectatorView,
  withRound,
} from './state.js';
import {
  deleteImposterDrawState,
  getImposterDrawState,
  setImposterDrawState,
} from './store.js';

function gameNotReadyError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'INVALID_PHASE',
      message: 'Game is not ready yet.',
    },
  };
}

function notParticipantError(): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'NOT_PARTICIPANT',
      message: 'أنت لست مشاركاً في هذه الجولة.',
    },
  };
}

function invalidActionError(
  message: string,
): Extract<GameActionResponse<never>, { success: false }> {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
    },
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

function clearImposterDrawRuntime(roomId: string): void {
  clearImposterDrawPhaseTimerRuntime(roomId);
  deleteImposterDrawState(roomId);
}

function respondWithView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getImposterDrawState(roomId);

  if (!shell || !match) {
    sendGameResponse(callback, gameNotReadyError());
    return;
  }

  const view = match.playerIds.includes(playerId)
    ? buildImposterDrawPlayerView(match, playerId, shell)
    : buildImposterDrawSpectatorView(match);

  sendGameResponse(callback, {
    success: true,
    data: { view },
  });
}

function broadcastCanvasUpdated(
  io: Server,
  roomId: string,
  turnId: string,
  strokes: DrawStroke[],
  currentTurnStrokeIds: string[],
): void {
  io.to(getRoomChannel(roomId)).emit(IMPOSTER_DRAW_CANVAS_UPDATED_EVENT, {
    turnId,
    strokes,
    currentTurnStrokeIds,
  });
}

function parseTurnId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const turnId = (payload as { turnId?: unknown }).turnId;
  return typeof turnId === 'string' && turnId.length > 0 ? turnId : null;
}

function mapStrokeCommandError(
  error: 'invalid-payload' | 'unauthorized' | 'stale-turn' | 'missing-stroke' | 'limit',
): Extract<GameActionResponse<never>, { success: false }> {
  if (error === 'stale-turn') {
    return invalidActionError('انتهت جولة الرسم الحالية.');
  }

  if (error === 'unauthorized') {
    return invalidActionError('ليس دورك للرسم.');
  }

  if (error === 'missing-stroke') {
    return invalidActionError('لم يتم العثور على خط الرسم.');
  }

  return invalidActionError('بيانات الرسم غير صالحة.');
}

function mapStrokePointsError(
  error:
    | 'invalid-payload'
    | 'unauthorized'
    | 'stale-turn'
    | 'missing-stroke'
    | 'limit'
    | 'protected-stroke',
): Extract<GameActionResponse<never>, { success: false }> {
  if (error === 'stale-turn') {
    return invalidActionError('انتهت جولة الرسم الحالية.');
  }

  if (error === 'unauthorized') {
    return invalidActionError('ليس دورك للرسم.');
  }

  if (error === 'missing-stroke') {
    return invalidActionError('لم يتم العثور على خط الرسم.');
  }

  if (error === 'protected-stroke') {
    return invalidActionError('لا يمكن تعديل خط من دور سابق.');
  }

  return invalidActionError('بيانات نقاط الرسم غير صالحة.');
}

function currentDrawerId(match: NonNullable<ReturnType<typeof getImposterDrawState>>): string | null {
  if (match.round.gamePhase !== 'drawing-turns') {
    return null;
  }

  return match.round.drawingOrder[match.round.currentDrawerIndex] ?? null;
}

function assertActiveDrawerTurn(
  match: NonNullable<ReturnType<typeof getImposterDrawState>>,
  playerId: string,
  turnId: string | null,
): Extract<GameActionResponse<never>, { success: false }> | null {
  if (!turnId || match.round.turnId !== turnId) {
    return invalidActionError('انتهت جولة الرسم الحالية.');
  }

  if (currentDrawerId(match) !== playerId) {
    return invalidActionError('ليس دورك للرسم.');
  }

  return null;
}

export function registerImposterDrawSocketHandlers(io: Server, socket: Socket): void {
  socket.on(IMPOSTER_DRAW_SYNC_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    if (rejectIfGameSyncRateLimited(socket, callback)) {
      return;
    }

    const { playerId, roomId } = socket.data;

    try {
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== IMPOSTER_DRAW_GAME_ID) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (shell.phase === 'FINISHED') {
        clearImposterDrawRuntime(roomId!);
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const match = ensureImposterDrawMatchStateWithTimer(io, roomId!);

      if (!match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!isActiveMatchParticipant(shell, playerId!) || !match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, {
          success: true,
          data: { view: buildImposterDrawSpectatorView(match) },
        });
        return;
      }

      sendGameResponse(callback, {
        success: true,
        data: { view: buildImposterDrawPlayerView(match, playerId!, shell) },
      });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(IMPOSTER_DRAW_SUBMIT_ROLE_UNDERSTOOD_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);
      const match = getImposterDrawState(roomId!);

      if (!shell || shell.gameId !== IMPOSTER_DRAW_GAME_ID || shell.phase !== 'PLAYING' || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      if (match.round.gamePhase !== 'briefing') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const nextMatch = applyBriefingAcknowledgement(io, roomId!, match, shell, playerId!);

      sendGameResponse(callback, {
        success: true,
        data: { view: buildImposterDrawPlayerView(nextMatch, playerId!, shell) },
      });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(IMPOSTER_DRAW_STROKE_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);
      const match = getImposterDrawState(roomId!);

      if (!shell || shell.gameId !== IMPOSTER_DRAW_GAME_ID || shell.phase !== 'PLAYING' || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      const result = processStrokeCommand({
        playerIsCurrentDrawer: currentDrawerId(match) === playerId,
        currentTurnId: match.round.turnId,
        strokes: match.round.strokes,
        payload,
        limits: IMPOSTER_DRAW_BOARD_LIMITS,
      });

      if (!result.ok) {
        sendGameResponse(callback, mapStrokeCommandError(result.error));
        return;
      }

      if (result.kind === 'end' || result.kind === 'start-noop') {
        sendGameResponse(callback, { success: true, data: { ok: true } });
        return;
      }

      const nextTurnStrokeIds = match.round.currentTurnStrokeIds.includes(result.strokeId)
          ? match.round.currentTurnStrokeIds
          : [...match.round.currentTurnStrokeIds, result.strokeId];

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: result.strokes,
        currentTurnStrokeIds: nextTurnStrokeIds,
      });

      setImposterDrawState(roomId!, nextMatch);
      broadcastCanvasUpdated(
        io,
        roomId!,
        match.round.turnId,
        result.strokes,
        nextTurnStrokeIds,
      );
      sendGameResponse(callback, { success: true, data: { ok: true } });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(IMPOSTER_DRAW_STROKE_POINTS_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);
      const match = getImposterDrawState(roomId!);

      if (!shell || shell.gameId !== IMPOSTER_DRAW_GAME_ID || shell.phase !== 'PLAYING' || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      const result = processStrokePointsCommand({
        playerIsCurrentDrawer: currentDrawerId(match) === playerId,
        currentTurnId: match.round.turnId,
        strokes: match.round.strokes,
        payload,
        limits: IMPOSTER_DRAW_BOARD_LIMITS,
        allowedStrokeIds: match.round.currentTurnStrokeIds,
      });

      if (!result.ok) {
        sendGameResponse(callback, mapStrokePointsError(result.error));
        return;
      }

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: result.strokes,
      });

      setImposterDrawState(roomId!, nextMatch);
      socket.to(getRoomChannel(roomId!)).emit(IMPOSTER_DRAW_STROKE_POINTS_EVENT, {
        turnId: result.turnId,
        strokeId: result.strokeId,
        points: result.points,
      });
      sendGameResponse(callback, { success: true, data: { ok: true } });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(IMPOSTER_DRAW_UNDO_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);
      const match = getImposterDrawState(roomId!);

      if (!shell || shell.gameId !== IMPOSTER_DRAW_GAME_ID || shell.phase !== 'PLAYING' || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      const turnId = parseTurnId(payload);
      const authError = assertActiveDrawerTurn(match, playerId!, turnId);

      if (authError) {
        sendGameResponse(callback, authError);
        return;
      }

      const strokeIds = match.round.currentTurnStrokeIds;

      if (strokeIds.length === 0) {
        sendGameResponse(callback, {
          success: true,
          data: { view: buildImposterDrawPlayerView(match, playerId!, shell) },
        });
        return;
      }

      const strokeIdToRemove = strokeIds[strokeIds.length - 1]!;
      const nextTurnStrokeIds = strokeIds.slice(0, -1);
      const nextStrokes = match.round.strokes.filter((stroke) => stroke.id !== strokeIdToRemove);

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: nextStrokes,
        currentTurnStrokeIds: nextTurnStrokeIds,
      });

      setImposterDrawState(roomId!, nextMatch);
      broadcastCanvasUpdated(
        io,
        roomId!,
        match.round.turnId,
        nextStrokes,
        nextTurnStrokeIds,
      );

      sendGameResponse(callback, {
        success: true,
        data: { view: buildImposterDrawPlayerView(nextMatch, playerId!, shell) },
      });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(IMPOSTER_DRAW_SUBMIT_VOTE_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);
      const match = getImposterDrawState(roomId!);

      if (!shell || shell.gameId !== IMPOSTER_DRAW_GAME_ID || shell.phase !== 'PLAYING' || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      if (match.round.gamePhase !== 'voting') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (match.round.submittedVoterIds.includes(playerId!)) {
        sendGameResponse(callback, invalidActionError('لقد صوّت بالفعل.'));
        return;
      }

      const targetPlayerId =
        payload && typeof payload === 'object'
          ? (payload as ImposterDrawSubmitVotePayload).targetPlayerId
          : undefined;

      if (typeof targetPlayerId !== 'string' || !match.playerIds.includes(targetPlayerId)) {
        sendGameResponse(callback, invalidActionError('اختيار التصويت غير صالح.'));
        return;
      }

      if (targetPlayerId === playerId) {
        sendGameResponse(callback, invalidActionError('لا يمكنك التصويت لنفسك.'));
        return;
      }

      const nextMatch = applyVoteSubmission(io, roomId!, match, shell, playerId!, targetPlayerId);

      sendGameResponse(callback, {
        success: true,
        data: { view: buildImposterDrawPlayerView(nextMatch, playerId!, shell) },
      });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT, async (payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);
      const match = getImposterDrawState(roomId!);

      if (!shell || shell.gameId !== IMPOSTER_DRAW_GAME_ID || shell.phase !== 'PLAYING' || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      if (match.round.gamePhase !== 'impostor-guess') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (match.round.impostorPlayerId !== playerId) {
        sendGameResponse(callback, invalidActionError('فقط الإمبوستر يمكنه التخمين.'));
        return;
      }

      const selectedWord =
        payload && typeof payload === 'object'
          ? (payload as ImposterDrawSubmitImageGuessPayload).selectedWord
          : undefined;

      if (
        typeof selectedWord !== 'string' ||
        !match.round.impostorGuessOptions.includes(selectedWord)
      ) {
        sendGameResponse(callback, invalidActionError('التخمين غير صالح.'));
        return;
      }

      const nextMatch = applyImageGuessSubmission(io, roomId!, match, playerId!, selectedWord);

      sendGameResponse(callback, {
        success: true,
        data: { view: buildImposterDrawPlayerView(nextMatch, playerId!, shell) },
      });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });

  socket.on(IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    if (recoveryBlockedResponse(roomId!, callback)) {
      return;
    }

    try {
      const shell = getGameShellByRoomId(roomId!);

      if (!shell || shell.gameId !== IMPOSTER_DRAW_GAME_ID || shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (shell.hostPlayerId !== playerId) {
        sendGameResponse(callback, {
          success: false,
          error: {
            code: 'NOT_HOST',
            message: 'فقط المضيف يمكنه المتابعة.',
          },
        });
        return;
      }

      const match = getImposterDrawState(roomId!);

      if (
        !match ||
        (match.round.gamePhase !== 'round-results' && match.round.gamePhase !== 'match-completed')
      ) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      continueFromRoundResults(io, roomId!, match, shell, playerId!);

      if (getImposterDrawState(roomId!)) {
        respondWithView(callback, roomId!, playerId!);
        return;
      }

      sendGameResponse(callback, {
        success: true,
        data: {},
      });
    } catch {
      sendGameResponse(callback, {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  });
}
