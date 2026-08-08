import type { Server, Socket } from 'socket.io';
import type {
  DrawStroke,
  GameActionResponse,
  ImposterDrawStrokePayload,
  ImposterDrawStrokePointsPayload,
  ImposterDrawSubmitImageGuessPayload,
  ImposterDrawSubmitVotePayload,
} from '@wanasatna/shared';
import {
  IMPOSTER_DRAW_CANVAS_UPDATED_EVENT,
  IMPOSTER_DRAW_CLEAR_CANVAS_EVENT,
  IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT,
  IMPOSTER_DRAW_GAME_ID,
  IMPOSTER_DRAW_STROKE_EVENT,
  IMPOSTER_DRAW_STROKE_POINTS_EVENT,
  IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT,
  IMPOSTER_DRAW_SUBMIT_VOTE_EVENT,
  IMPOSTER_DRAW_SYNC_EVENT,
  isActiveMatchParticipant,
} from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { getGameSocketContext, sendGameResponse } from '../../game.socket.utils.js';
import {
  isPlayerRecoveryActive,
  playerRecoveryBlockedError,
} from '../../runtime/player-recovery.js';
import { ensureImposterDrawMatchStateWithTimer } from './init-match.js';
import {
  applyImageGuessSubmission,
  applyVoteSubmission,
  continueFromRoundResults,
} from './match-lifecycle.js';
import { stopImposterDrawPhaseTimer } from './phase-timer.js';
import { buildImposterDrawPlayerView, withRound } from './state.js';
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
  stopImposterDrawPhaseTimer(roomId);
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

  sendGameResponse(callback, {
    success: true,
    data: { view: buildImposterDrawPlayerView(match, playerId, shell) },
  });
}

function broadcastCanvasUpdated(io: Server, roomId: string, strokes: DrawStroke[]): void {
  io.to(getRoomChannel(roomId)).emit(IMPOSTER_DRAW_CANVAS_UPDATED_EVENT, { strokes });
}

function isStrokePoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && typeof point.y === 'number';
}

function parseStrokePayload(payload: unknown): ImposterDrawStrokePayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Partial<ImposterDrawStrokePayload>;

  if (
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
    strokeId: data.strokeId,
    tool: data.tool,
    color: data.color,
    size: data.size,
    points: data.points,
  };
}

function parseStrokePointsPayload(payload: unknown): ImposterDrawStrokePointsPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Partial<ImposterDrawStrokePointsPayload>;

  if (
    typeof data.strokeId !== 'string' ||
    !Array.isArray(data.points) ||
    !data.points.every(isStrokePoint)
  ) {
    return null;
  }

  return {
    strokeId: data.strokeId,
    points: data.points,
  };
}

function currentDrawerId(match: NonNullable<ReturnType<typeof getImposterDrawState>>): string | null {
  if (match.round.gamePhase !== 'drawing-turns') {
    return null;
  }

  return match.round.drawingOrder[match.round.currentDrawerIndex] ?? null;
}

export function registerImposterDrawSocketHandlers(io: Server, socket: Socket): void {
  socket.on(IMPOSTER_DRAW_SYNC_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
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

      if (!isActiveMatchParticipant(shell, playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      const match = ensureImposterDrawMatchStateWithTimer(io, roomId!);

      if (!match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!match.playerIds.includes(playerId!)) {
        sendGameResponse(callback, notParticipantError());
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

      if (currentDrawerId(match) !== playerId) {
        sendGameResponse(callback, invalidActionError('ليس دورك للرسم.'));
        return;
      }

      const strokePayload = parseStrokePayload(payload);

      if (!strokePayload) {
        sendGameResponse(callback, invalidActionError('بيانات الرسم غير صالحة.'));
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

      setImposterDrawState(roomId!, nextMatch);
      broadcastCanvasUpdated(io, roomId!, nextStrokes);

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

      if (currentDrawerId(match) !== playerId) {
        sendGameResponse(callback, invalidActionError('ليس دورك للرسم.'));
        return;
      }

      const pointsPayload = parseStrokePointsPayload(payload);

      if (!pointsPayload) {
        sendGameResponse(callback, invalidActionError('بيانات نقاط الرسم غير صالحة.'));
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

      setImposterDrawState(roomId!, nextMatch);
      io.to(getRoomChannel(roomId!)).emit(IMPOSTER_DRAW_STROKE_POINTS_EVENT, pointsPayload);

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

  socket.on(IMPOSTER_DRAW_CLEAR_CANVAS_EVENT, async (_payload: unknown, callback) => {
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

      if (currentDrawerId(match) !== playerId) {
        sendGameResponse(callback, invalidActionError('فقط صاحب الدور يمكنه مسح اللوحة.'));
        return;
      }

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: [],
      });

      setImposterDrawState(roomId!, nextMatch);
      broadcastCanvasUpdated(io, roomId!, []);

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

      if (typeof selectedWord !== 'string' || !match.round.impostorGuessOptions.includes(selectedWord)) {
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
