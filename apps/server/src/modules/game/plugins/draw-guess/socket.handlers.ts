import type { Server, Socket } from 'socket.io';
import type {
  DrawGuessSubmitGuessPayload,
  DrawStroke,
  GameActionResponse,
} from '@wanasatna/shared';
import {
  DRAW_GUESS_CANVAS_UPDATED_EVENT,
  DRAW_GUESS_CLEAR_CANVAS_EVENT,
  DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT,
  DRAW_GUESS_GAME_ID,
  DRAW_GUESS_STROKE_EVENT,
  DRAW_GUESS_STROKE_POINTS_EVENT,
  DRAW_GUESS_SUBMIT_GUESS_EVENT,
  DRAW_GUESS_SYNC_EVENT,
  DRAW_GUESS_UNDO_EVENT,
  isActiveMatchParticipant,
} from '@wanasatna/shared';
import { isOversizedGameAnswer } from '../../runtime/game-answer-text.js';
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
  applyDrawGuessLobbySettings,
  clearDrawGuessRoomDrawerSettings,
} from './drawer-mode-store.js';
import { ensureDrawGuessMatchStateWithTimer } from './init-match.js';
import { continueFromRoundResults, endDrawingRound } from './match-lifecycle.js';
import { clearDrawGuessPhaseTimerRuntime } from './phase-timer.js';
import {
  buildDrawGuessPlayerView,
  buildDrawGuessSpectatorView,
  withRound,
} from './state.js';
import { deleteDrawGuessState, getDrawGuessState, setDrawGuessState } from './store.js';
import { isCorrectGuess } from './words.js';
import {
  DRAW_GUESS_BOARD_LIMITS,
  processStrokeCommand,
  processStrokePointsCommand,
} from '../../runtime/drawing-strokes.js';

export { applyDrawGuessLobbySettings };

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

function clearDrawGuessRuntime(roomId: string): void {
  clearDrawGuessPhaseTimerRuntime(roomId);
  deleteDrawGuessState(roomId);
  clearDrawGuessRoomDrawerSettings(roomId);
}

function respondWithView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getDrawGuessState(roomId);

  if (!shell || !match) {
    sendGameResponse(callback, gameNotReadyError());
    return;
  }

  sendGameResponse(callback, {
    success: true,
    data: { view: buildDrawGuessPlayerView(match, playerId, shell) },
  });
}

function broadcastCanvasUpdated(
  io: Server,
  roomId: string,
  turnId: string,
  strokes: DrawStroke[],
): void {
  io.to(getRoomChannel(roomId)).emit(DRAW_GUESS_CANVAS_UPDATED_EVENT, { turnId, strokes });
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
    return invalidActionError('فقط الرسام يمكنه الرسم.');
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
    return invalidActionError('فقط الرسام يمكنه الرسم.');
  }

  if (error === 'missing-stroke') {
    return invalidActionError('لم يتم العثور على خط الرسم.');
  }

  return invalidActionError('بيانات نقاط الرسم غير صالحة.');
}

function assertActiveDrawerTurn(
  match: NonNullable<ReturnType<typeof getDrawGuessState>>,
  playerId: string,
  turnId: string | null,
): Extract<GameActionResponse<never>, { success: false }> | null {
  if (!turnId || match.round.turnId !== turnId) {
    return invalidActionError('انتهت جولة الرسم الحالية.');
  }

  if (match.round.gamePhase !== 'drawing' || match.round.drawerPlayerId !== playerId) {
    return invalidActionError('فقط الرسام يمكنه الرسم.');
  }

  return null;
}

export function registerDrawGuessSocketHandlers(io: Server, socket: Socket): void {
  socket.on(DRAW_GUESS_SYNC_EVENT, async (_payload: unknown, callback) => {
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

      if (!shell || shell.gameId !== DRAW_GUESS_GAME_ID) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (shell.phase === 'FINISHED') {
        clearDrawGuessRuntime(roomId!);
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (shell.phase !== 'PLAYING') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      const match = ensureDrawGuessMatchStateWithTimer(io, roomId!);

      if (!match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!isActiveMatchParticipant(shell, playerId!) || !match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, {
          success: true,
          data: { view: buildDrawGuessSpectatorView(match) },
        });
        return;
      }

      sendGameResponse(callback, {
        success: true,
        data: { view: buildDrawGuessPlayerView(match, playerId!, shell) },
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

  socket.on(DRAW_GUESS_STROKE_EVENT, async (payload: unknown, callback) => {
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
      const match = getDrawGuessState(roomId!);

      if (!shell || shell.gameId !== DRAW_GUESS_GAME_ID || shell.phase !== 'PLAYING' || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      const result = processStrokeCommand({
        playerIsCurrentDrawer:
          match.round.gamePhase === 'drawing' && match.round.drawerPlayerId === playerId,
        currentTurnId: match.round.turnId,
        strokes: match.round.strokes,
        payload,
        limits: DRAW_GUESS_BOARD_LIMITS,
      });

      if (!result.ok) {
        sendGameResponse(callback, mapStrokeCommandError(result.error));
        return;
      }

      if (result.kind === 'end' || result.kind === 'start-noop') {
        sendGameResponse(callback, { success: true, data: { ok: true } });
        return;
      }

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: result.strokes,
      });

      setDrawGuessState(roomId!, nextMatch);
      broadcastCanvasUpdated(io, roomId!, match.round.turnId, result.strokes);
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

  socket.on(DRAW_GUESS_STROKE_POINTS_EVENT, async (payload: unknown, callback) => {
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
      const match = getDrawGuessState(roomId!);

      if (!shell || shell.gameId !== DRAW_GUESS_GAME_ID || shell.phase !== 'PLAYING' || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      const result = processStrokePointsCommand({
        playerIsCurrentDrawer:
          match.round.gamePhase === 'drawing' && match.round.drawerPlayerId === playerId,
        currentTurnId: match.round.turnId,
        strokes: match.round.strokes,
        payload,
        limits: DRAW_GUESS_BOARD_LIMITS,
      });

      if (!result.ok) {
        sendGameResponse(callback, mapStrokePointsError(result.error));
        return;
      }

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: result.strokes,
      });

      setDrawGuessState(roomId!, nextMatch);
      socket.to(getRoomChannel(roomId!)).emit(DRAW_GUESS_STROKE_POINTS_EVENT, {
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

  socket.on(DRAW_GUESS_CLEAR_CANVAS_EVENT, async (payload: unknown, callback) => {
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
      const match = getDrawGuessState(roomId!);

      if (!shell || shell.gameId !== DRAW_GUESS_GAME_ID || shell.phase !== 'PLAYING' || !match) {
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

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: [],
      });

      setDrawGuessState(roomId!, nextMatch);
      broadcastCanvasUpdated(io, roomId!, match.round.turnId, []);

      sendGameResponse(callback, {
        success: true,
        data: { view: buildDrawGuessPlayerView(nextMatch, playerId!, shell) },
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

  socket.on(DRAW_GUESS_UNDO_EVENT, async (payload: unknown, callback) => {
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
      const match = getDrawGuessState(roomId!);

      if (!shell || shell.gameId !== DRAW_GUESS_GAME_ID || shell.phase !== 'PLAYING' || !match) {
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

      const nextStrokes =
        match.round.strokes.length === 0
          ? match.round.strokes
          : match.round.strokes.slice(0, -1);

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: nextStrokes,
      });

      setDrawGuessState(roomId!, nextMatch);
      broadcastCanvasUpdated(io, roomId!, match.round.turnId, nextStrokes);

      sendGameResponse(callback, {
        success: true,
        data: { view: buildDrawGuessPlayerView(nextMatch, playerId!, shell) },
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

  socket.on(DRAW_GUESS_SUBMIT_GUESS_EVENT, async (payload: unknown, callback) => {
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
      const match = getDrawGuessState(roomId!);

      if (!shell || shell.gameId !== DRAW_GUESS_GAME_ID || shell.phase !== 'PLAYING' || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      if (match.round.gamePhase !== 'drawing') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (match.round.drawerPlayerId === playerId) {
        sendGameResponse(callback, invalidActionError('الرسام لا يمكنه التخمين.'));
        return;
      }

      const guess =
        payload && typeof payload === 'object'
          ? (payload as DrawGuessSubmitGuessPayload).guess
          : undefined;

      if (typeof guess !== 'string' || guess.trim().length === 0) {
        sendGameResponse(callback, invalidActionError('التخمين غير صالح.'));
        return;
      }

      if (isOversizedGameAnswer(guess)) {
        sendGameResponse(callback, invalidActionError('التخمين طويل جداً.'));
        return;
      }

      if (!isCorrectGuess(guess, match.round.word)) {
        sendGameResponse(callback, {
          success: true,
          data: {
            correct: false,
            feedback: 'إجابة خاطئة',
            view: buildDrawGuessPlayerView(match, playerId!, shell),
          },
        });
        return;
      }

      const nextMatch = endDrawingRound(io, roomId!, match, {
        guessedCorrectly: true,
        correctGuesserPlayerId: playerId!,
      });

      sendGameResponse(callback, {
        success: true,
        data: {
          correct: true,
          view: buildDrawGuessPlayerView(nextMatch, playerId!, shell),
        },
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

  socket.on(DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT, async (_payload: unknown, callback) => {
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

      if (!shell || shell.gameId !== DRAW_GUESS_GAME_ID || shell.phase !== 'PLAYING') {
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

      const match = getDrawGuessState(roomId!);

      if (
        !match ||
        (match.round.gamePhase !== 'round-results' &&
          match.round.gamePhase !== 'match-completed')
      ) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      continueFromRoundResults(io, roomId!, match, shell, playerId!);

      if (getDrawGuessState(roomId!)) {
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
