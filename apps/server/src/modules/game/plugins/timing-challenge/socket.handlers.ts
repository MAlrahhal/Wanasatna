import type { Server, Socket } from 'socket.io';
import type { GameActionResponse, TimingChallengeSubmitGuessPayload } from '@wanasatna/shared';
import {
  TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  TIMING_CHALLENGE_GAME_ID,
  TIMING_CHALLENGE_PHASE_CHANGED_EVENT,
  TIMING_CHALLENGE_READY_EVENT,
  TIMING_CHALLENGE_START_TIMER_EVENT,
  TIMING_CHALLENGE_STOP_TIMER_EVENT,
  TIMING_CHALLENGE_SUBMIT_GUESS_EVENT,
  TIMING_CHALLENGE_SYNC_EVENT,
  isActiveMatchParticipant,
} from '@wanasatna/shared';
import { getRoomChannel } from '../../../room/room.utils.js';
import { getGameShellByRoomId } from '../../game.service.js';
import { getGameSocketContext, sendGameResponse } from '../../game.socket.utils.js';
import {
  isPlayerRecoveryActive,
  playerRecoveryBlockedError,
} from '../../runtime/player-recovery.js';
import { ensureTimingChallengeMatchStateWithTimer } from './init-match.js';
import {
  advanceFromReady,
  continueFromRoundResults,
  startRoundResults,
} from './match-lifecycle.js';
import { clearTimingChallengePhaseTimerRuntime } from './phase-timer.js';
import { normalizeTimingChallengeSettings } from './settings.js';
import {
  allConnectedGuessed,
  allConnectedReady,
  allConnectedStopped,
  buildTimingChallengePlayerView,
  withRound,
} from './state.js';
import {
  clearTimingChallengeSettings,
  deleteTimingChallengeState,
  getTimingChallengeState,
  setTimingChallengeSettings,
  setTimingChallengeState,
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

function clearTimingChallengeRuntime(roomId: string): void {
  clearTimingChallengePhaseTimerRuntime(roomId);
  deleteTimingChallengeState(roomId);
  clearTimingChallengeSettings(roomId);
}

function respondWithView(
  callback: ((response: GameActionResponse<{ view: unknown }>) => void) | undefined,
  roomId: string,
  playerId: string,
): void {
  const shell = getGameShellByRoomId(roomId);
  const match = getTimingChallengeState(roomId);

  if (!shell || !match) {
    sendGameResponse(callback, gameNotReadyError());
    return;
  }

  sendGameResponse(callback, {
    success: true,
    data: { view: buildTimingChallengePlayerView(match, playerId, shell) },
  });
}

function broadcastPhase(io: Server, roomId: string): void {
  io.to(getRoomChannel(roomId)).emit(TIMING_CHALLENGE_PHASE_CHANGED_EVENT, {});
}

export function registerTimingChallengeSocketHandlers(io: Server, socket: Socket): void {
  socket.on(TIMING_CHALLENGE_SYNC_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;
    const shell = getGameShellByRoomId(roomId!);

    if (!shell || shell.gameId !== TIMING_CHALLENGE_GAME_ID) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (shell.phase === 'PLAYING') {
      ensureTimingChallengeMatchStateWithTimer(io, roomId!);
    }

    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(TIMING_CHALLENGE_READY_EVENT, (_payload: unknown, callback) => {
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
    const match = ensureTimingChallengeMatchStateWithTimer(io, roomId!);

    if (!shell || !match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (!isActiveMatchParticipant(shell, playerId!)) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    if (match.round.gamePhase !== 'ready') {
      sendGameResponse(callback, invalidActionError('مرحلة الاستعداد انتهت.'));
      return;
    }

    const playerState = match.round.playerStates[playerId!];

    if (!playerState) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    if (playerState.ready) {
      respondWithView(callback, roomId!, playerId!);
      return;
    }

    let nextMatch = withRound(match, {
      ...match.round,
      playerStates: {
        ...match.round.playerStates,
        [playerId!]: { ...playerState, ready: true },
      },
    });

    setTimingChallengeState(roomId!, nextMatch);

    if (allConnectedReady(nextMatch, shell)) {
      nextMatch = advanceFromReady(io, roomId!, nextMatch);
    } else {
      broadcastPhase(io, roomId!);
    }

    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(
    TIMING_CHALLENGE_SUBMIT_GUESS_EVENT,
    (payload: TimingChallengeSubmitGuessPayload, callback) => {
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
      const match = getTimingChallengeState(roomId!);

      if (!shell || !match) {
        sendGameResponse(callback, gameNotReadyError());
        return;
      }

      if (!isActiveMatchParticipant(shell, playerId!)) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      if (match.settings.mode !== 'guess-time' || match.round.gamePhase !== 'guessing') {
        sendGameResponse(callback, invalidActionError('لا يمكن التخمين الآن.'));
        return;
      }

      const playerState = match.round.playerStates[playerId!];

      if (!playerState) {
        sendGameResponse(callback, notParticipantError());
        return;
      }

      if (playerState.guessMs !== null) {
        sendGameResponse(callback, invalidActionError('تم إرسال تخمينك مسبقاً.'));
        return;
      }

      const guessSeconds = Number(payload?.guessSeconds);

      if (!Number.isFinite(guessSeconds) || guessSeconds < 0 || guessSeconds > 120) {
        sendGameResponse(callback, invalidActionError('قيمة التخمين غير صالحة.'));
        return;
      }

      const guessMs = Math.round(guessSeconds * 1000);
      let nextMatch = withRound(match, {
        ...match.round,
        playerStates: {
          ...match.round.playerStates,
          [playerId!]: {
            ...playerState,
            guessMs,
            errorMs: Math.abs(guessMs - match.round.targetMs),
            signedDeltaMs: guessMs - match.round.targetMs,
            elapsedMs: guessMs,
          },
        },
      });

      setTimingChallengeState(roomId!, nextMatch);

      if (allConnectedGuessed(nextMatch, shell)) {
        nextMatch = startRoundResults(io, roomId!, nextMatch);
      } else {
        broadcastPhase(io, roomId!);
      }

      respondWithView(callback, roomId!, playerId!);
    },
  );

  socket.on(TIMING_CHALLENGE_START_TIMER_EVENT, (_payload: unknown, callback) => {
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
    const match = getTimingChallengeState(roomId!);

    if (!shell || !match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (!isActiveMatchParticipant(shell, playerId!)) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    if (match.settings.mode !== 'stop-timer' || match.round.gamePhase !== 'stop-timer') {
      sendGameResponse(callback, invalidActionError('لا يمكن بدء المؤقت الآن.'));
      return;
    }

    const playerState = match.round.playerStates[playerId!];

    if (!playerState) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    if (playerState.timerStartedAtMs !== null) {
      sendGameResponse(callback, invalidActionError('تم بدء المؤقت مسبقاً.'));
      return;
    }

    const nextMatch = withRound(match, {
      ...match.round,
      playerStates: {
        ...match.round.playerStates,
        [playerId!]: {
          ...playerState,
          timerStartedAtMs: Date.now(),
        },
      },
    });

    setTimingChallengeState(roomId!, nextMatch);
    broadcastPhase(io, roomId!);
    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(TIMING_CHALLENGE_STOP_TIMER_EVENT, (_payload: unknown, callback) => {
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
    const match = getTimingChallengeState(roomId!);

    if (!shell || !match) {
      sendGameResponse(callback, gameNotReadyError());
      return;
    }

    if (!isActiveMatchParticipant(shell, playerId!)) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    if (match.settings.mode !== 'stop-timer' || match.round.gamePhase !== 'stop-timer') {
      sendGameResponse(callback, invalidActionError('لا يمكن إيقاف المؤقت الآن.'));
      return;
    }

    const playerState = match.round.playerStates[playerId!];

    if (!playerState) {
      sendGameResponse(callback, notParticipantError());
      return;
    }

    if (playerState.timerStartedAtMs === null) {
      sendGameResponse(callback, invalidActionError('يجب بدء المؤقت أولاً.'));
      return;
    }

    if (playerState.elapsedMs !== null) {
      sendGameResponse(callback, invalidActionError('تم إيقاف المؤقت مسبقاً.'));
      return;
    }

    const stoppedAtMs = Date.now();
    const elapsedMs = Math.max(0, stoppedAtMs - playerState.timerStartedAtMs);
    const signedDeltaMs = elapsedMs - match.round.targetMs;
    const errorMs = Math.abs(signedDeltaMs);

    let nextMatch = withRound(match, {
      ...match.round,
      playerStates: {
        ...match.round.playerStates,
        [playerId!]: {
          ...playerState,
          stoppedAtMs,
          elapsedMs,
          signedDeltaMs,
          errorMs,
        },
      },
    });

    setTimingChallengeState(roomId!, nextMatch);

    if (allConnectedStopped(nextMatch, shell)) {
      nextMatch = startRoundResults(io, roomId!, nextMatch);
    } else {
      broadcastPhase(io, roomId!);
    }

    respondWithView(callback, roomId!, playerId!);
  });

  socket.on(TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT, (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId, playerId } = socket.data;
    const shell = getGameShellByRoomId(roomId!);
    const match = getTimingChallengeState(roomId!);

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
    respondWithView(callback, roomId!, playerId!);
  });
}

export function applyTimingChallengeLobbySettings(
  roomId: string,
  settingsInput: unknown,
): { success: true } | { success: false; error: string } {
  const normalized = normalizeTimingChallengeSettings(
    settingsInput && typeof settingsInput === 'object'
      ? (settingsInput as Parameters<typeof normalizeTimingChallengeSettings>[0])
      : null,
  );

  if ('error' in normalized) {
    return { success: false, error: normalized.error };
  }

  setTimingChallengeSettings(roomId, normalized);
  return { success: true };
}

export { clearTimingChallengeRuntime };
