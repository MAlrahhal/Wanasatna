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
import { getGameSocketContext, sendGameResponse } from '../../game.socket.utils.js';
import {
  isPlayerRecoveryActive,
  playerRecoveryBlockedError,
} from '../../runtime/player-recovery.js';
import {
  appendAuthoritativeStrokePoints,
  hasAuthoritativeStroke,
  startAuthoritativeStroke,
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

function parseStrokePayload(
  payload: unknown,
):
  | { kind: 'start'; value: ImposterDrawStrokePayload & { tool: 'draw' | 'erase'; color: string; size: number; points: DrawStroke['points'] } }
  | { kind: 'end'; turnId: string; strokeId: string }
  | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Partial<ImposterDrawStrokePayload>;
  const turnId = parseTurnId(payload);

  if (!turnId || typeof data.strokeId !== 'string') {
    return null;
  }

  if (!Array.isArray(data.points) || data.points.length === 0) {
    return { kind: 'end', turnId, strokeId: data.strokeId };
  }

  if (
    (data.tool !== 'draw' && data.tool !== 'erase') ||
    typeof data.color !== 'string' ||
    typeof data.size !== 'number' ||
    !data.points.every(isStrokePoint)
  ) {
    return null;
  }

  return {
    kind: 'start',
    value: {
      turnId,
      strokeId: data.strokeId,
      tool: data.tool,
      color: data.color,
      size: data.size,
      points: data.points,
    },
  };
}

function parseStrokePointsPayload(payload: unknown): ImposterDrawStrokePointsPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Partial<ImposterDrawStrokePointsPayload>;
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

      const strokePayload = parseStrokePayload(payload);

      if (!strokePayload) {
        sendGameResponse(callback, invalidActionError('بيانات الرسم غير صالحة.'));
        return;
      }

      const authError = assertActiveDrawerTurn(
        match,
        playerId!,
        strokePayload.kind === 'start' ? strokePayload.value.turnId : strokePayload.turnId,
      );

      if (authError) {
        sendGameResponse(callback, authError);
        return;
      }

      if (strokePayload.kind === 'end') {
        if (!hasAuthoritativeStroke(match.round.strokes, strokePayload.strokeId)) {
          sendGameResponse(callback, invalidActionError('لم يتم العثور على خط الرسم.'));
          return;
        }

        sendGameResponse(callback, { success: true, data: { ok: true } });
        return;
      }

      const started = startAuthoritativeStroke(match.round.strokes, {
        id: strokePayload.value.strokeId,
        tool: strokePayload.value.tool,
        color: strokePayload.value.color,
        size: strokePayload.value.size,
        points: strokePayload.value.points,
      });

      if (started.created) {
        const nextTurnStrokeIds = match.round.currentTurnStrokeIds.includes(
          strokePayload.value.strokeId,
        )
          ? match.round.currentTurnStrokeIds
          : [...match.round.currentTurnStrokeIds, strokePayload.value.strokeId];

        const nextMatch = withRound(match, {
          ...match.round,
          strokes: started.strokes,
          currentTurnStrokeIds: nextTurnStrokeIds,
        });

        setImposterDrawState(roomId!, nextMatch);
        broadcastCanvasUpdated(
          io,
          roomId!,
          match.round.turnId,
          started.strokes,
          nextTurnStrokeIds,
        );
      }

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

      if (!match.round.currentTurnStrokeIds.includes(pointsPayload.strokeId)) {
        sendGameResponse(callback, invalidActionError('لا يمكن تعديل خط من دور سابق.'));
        return;
      }

      const nextStrokes = appendAuthoritativeStrokePoints(
        match.round.strokes,
        pointsPayload.strokeId,
        pointsPayload.points,
      );

      if (!nextStrokes) {
        sendGameResponse(callback, invalidActionError('لم يتم العثور على خط الرسم.'));
        return;
      }

      const nextMatch = withRound(match, {
        ...match.round,
        strokes: nextStrokes,
      });

      setImposterDrawState(roomId!, nextMatch);
      socket.to(getRoomChannel(roomId!)).emit(IMPOSTER_DRAW_STROKE_POINTS_EVENT, pointsPayload);
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
