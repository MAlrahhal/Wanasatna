import type { Server, Socket } from 'socket.io';
import type {
  DrawGuessStrokePayload,
  DrawGuessStrokePointsPayload,
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
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { getGameSocketContext, sendGameResponse } from '../../game.socket.utils.js';
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

function isStrokePoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && typeof point.y === 'number';
}

function parseTurnId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const turnId = (payload as { turnId?: unknown }).turnId;
  return typeof turnId === 'string' && turnId.length > 0 ? turnId : null;
}

function parseStrokePayload(payload: unknown): DrawGuessStrokePayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Partial<DrawGuessStrokePayload>;
  const turnId = parseTurnId(payload);

  if (
    !turnId ||
    typeof data.strokeId !== 'string' ||
    (data.tool !== 'draw' && data.tool !== 'erase') ||
    typeof data.color !== 'string' ||
    typeof data.size !== 'number' ||
    !Array.isArray(data.points) ||
    !data.points.every(isStrokePoint)
  ) {
    return null;
  }

  return {
    turnId,
    strokeId: data.strokeId,
    tool: data.tool,
    color: data.color,
    size: data.size,
    points: data.points,
  };
}

function parseStrokePointsPayload(payload: unknown): DrawGuessStrokePointsPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Partial<DrawGuessStrokePointsPayload>;
  const turnId = parseTurnId(payload);

  if (
    !turnId ||
    typeof data.strokeId !== 'string' ||
    !Array.isArray(data.points) ||
    !data.points.every(isStrokePoint)
  ) {
    return null;
  }

  return {
    turnId,
    strokeId: data.strokeId,
    points: data.points,
  };
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

      const strokePayload = parseStrokePayload(payload);

      if (!strokePayload) {
        sendGameResponse(callback, invalidActionError('بيانات الرسم غير صالحة.'));
        return;
      }

      const authError = assertActiveDrawerTurn(match, playerId!, strokePayload.turnId);

      if (authError) {
        sendGameResponse(callback, authError);
        return;
      }

      const existingIndex = match.round.strokes.findIndex(
        (stroke) => stroke.id === strokePayload.strokeId,
      );

      const nextStroke: DrawStroke = {
        id: strokePayload.strokeId,
        tool: strokePayload.tool,
        color: strokePayload.color,
        size: strokePayload.size,
        points: strokePayload.points,
      };

      const nextStrokes =
        existingIndex >= 0
          ? match.round.strokes.map((stroke, index) =>
              index === existingIndex ? nextStroke : stroke,
            )
          : [...match.round.strokes, nextStroke];

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

      const pointsPayload = parseStrokePointsPayload(payload);

      if (!pointsPayload) {
        sendGameResponse(callback, invalidActionError('بيانات نقاط الرسم غير صالحة.'));
        return;
      }

      const authError = assertActiveDrawerTurn(match, playerId!, pointsPayload.turnId);

      if (authError) {
        sendGameResponse(callback, authError);
        return;
      }

      const strokeIndex = match.round.strokes.findIndex(
        (stroke) => stroke.id === pointsPayload.strokeId,
      );

      if (strokeIndex < 0) {
        sendGameResponse(callback, invalidActionError('لم يتم العثور على خط الرسم.'));
        return;
      }

      const nextStrokes = match.round.strokes.map((stroke, index) =>
        index === strokeIndex
          ? { ...stroke, points: [...stroke.points, ...pointsPayload.points] }
          : stroke,
      );

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: nextStrokes,
      });

      setDrawGuessState(roomId!, nextMatch);
      io.to(getRoomChannel(roomId!)).emit(DRAW_GUESS_STROKE_POINTS_EVENT, pointsPayload);

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

      if (!match || match.round.gamePhase !== 'round-results') {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      continueFromRoundResults(io, roomId!, match, shell, playerId!);
      respondWithView(callback, roomId!, playerId!);
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
