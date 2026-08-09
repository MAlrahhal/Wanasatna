import type { Server, Socket } from 'socket.io';
import {
  GAME_SHELL_CANCEL_COUNTDOWN_EVENT,
  GAME_SHELL_END_EVENT,
  GAME_SHELL_INIT_EVENT,
  GAME_SHELL_RESET_EVENT,
  GAME_SHELL_RETURN_TO_LOBBY_EVENT,
  GAME_SHELL_SET_READY_EVENT,
  GAME_SHELL_START_COUNTDOWN_EVENT,
  GAME_SHELL_START_FROM_LOBBY_EVENT,
  GAME_SHELL_SYNC_EVENT,
  GUESSING_CHALLENGE_GAME_ID,
  TIMING_CHALLENGE_GAME_ID,
} from '@wanasatna/shared';
import {
  cancelGameShellCountdown,
  getGameShellByRoomId,
  requestAbortGameShellByHost,
  initGameShell,
  resetGameShell,
  returnGameShellToLobby,
  setGameShellReady,
  startGameShellCountdown,
  startGameShellFromLobby,
  syncGameShell,
} from './game.service.js';
import {
  cleanupGameShellRuntime,
  ensureGameShellLifecycleProgress,
  navigateRoomToGame,
  navigateRoomToLobby,
  scheduleGameShellLifecycle,
} from './game.lifecycle.js';
import { abortActiveMatch } from './runtime/abort-active-match.js';
import { setRoomRoundCategory } from './runtime/round-category-store.js';
import { applyGuessingChallengeLobbySettings } from './plugins/guessing-challenge/socket.handlers.js';
import { applyTimingChallengeLobbySettings } from './plugins/timing-challenge/socket.handlers.js';
import { logGameShellDiagnostic } from './game.diagnostics.js';
import { broadcastRoomPlayersSnapshot } from '../room/room.utils.js';
import {
  broadcastGameShellState,
  startGameShellTimer,
  stopGameShellTimer,
} from './game.timer.js';
import {
  getGameSocketContext,
  sendGameInternalError,
  sendGameResponse,
} from './game.socket.utils.js';
import {
  validateInitGameShellPayload,
  validateSetGameShellReadyPayload,
  validateStartGameShellFromLobbyPayload,
} from './game.validators.js';

export function registerGameShellInitHandler(io: Server, socket: Socket): void {
  socket.on(
    GAME_SHELL_INIT_EVENT,
    async (payload: unknown, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const validation = validateInitGameShellPayload(payload);

      if (!validation.success) {
        sendGameResponse(callback, validation);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const response = await initGameShell(roomId!, playerId!, validation.data);

        if (response.success) {
          stopGameShellTimer(roomId!);
          broadcastGameShellState(io, response.data.state);
        }

        sendGameResponse(callback, response);
      } catch {
        sendGameInternalError(callback);
      }
    },
  );
}

export function registerGameShellSyncHandler(io: Server, socket: Socket): void {
  socket.on(GAME_SHELL_SYNC_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { roomId } = socket.data;

    try {
      // Sync first (authoritative current shell), then heal lifecycle. Ordering
      // matters: ensure must not race a stale sync write back to WAITING.
      const response = await syncGameShell(roomId!);

      ensureGameShellLifecycleProgress(io, roomId!);

      const latest = getGameShellByRoomId(roomId!);
      const state = latest ?? (response.success ? response.data.state : null);

      if (state) {
        broadcastGameShellState(io, state);
      }

      sendGameResponse(
        callback,
        response.success
          ? { success: true, data: { state } }
          : response,
      );
    } catch {
      sendGameInternalError(callback);
    }
  });
}

export function registerGameShellSetReadyHandler(io: Server, socket: Socket): void {
  socket.on(
    GAME_SHELL_SET_READY_EVENT,
    async (payload: unknown, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const validation = validateSetGameShellReadyPayload(payload);

      if (!validation.success) {
        sendGameResponse(callback, validation);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        const response = await setGameShellReady(
          roomId!,
          playerId!,
          validation.data.isReady,
        );

        if (response.success) {
          broadcastGameShellState(io, response.data.state);
        }

        sendGameResponse(callback, response);
      } catch {
        sendGameInternalError(callback);
      }
    },
  );
}

export function registerGameShellStartCountdownHandler(io: Server, socket: Socket): void {
  socket.on(GAME_SHELL_START_COUNTDOWN_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    try {
      const response = await startGameShellCountdown(roomId!, playerId!);

      if (response.success) {
        broadcastGameShellState(io, response.data.state);
        startGameShellTimer(io, roomId!, 'countdown');
      }

      sendGameResponse(callback, response);
    } catch {
      sendGameInternalError(callback);
    }
  });
}

export function registerGameShellCancelCountdownHandler(io: Server, socket: Socket): void {
  socket.on(GAME_SHELL_CANCEL_COUNTDOWN_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    try {
      const response = await cancelGameShellCountdown(roomId!, playerId!);

      if (response.success) {
        stopGameShellTimer(roomId!);
        broadcastGameShellState(io, response.data.state);
      }

      sendGameResponse(callback, response);
    } catch {
      sendGameInternalError(callback);
    }
  });
}

export function registerGameShellEndHandler(io: Server, socket: Socket): void {
  socket.on(GAME_SHELL_END_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    try {
      const response = await requestAbortGameShellByHost(roomId!, playerId!);

      if (response.success) {
        await abortActiveMatch(io, roomId!, 'host_aborted');
      }

      sendGameResponse(callback, response);
    } catch {
      sendGameInternalError(callback);
    }
  });
}

export function registerGameShellResetHandler(io: Server, socket: Socket): void {
  socket.on(GAME_SHELL_RESET_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    try {
      const response = await resetGameShell(roomId!, playerId!);

      if (response.success) {
        stopGameShellTimer(roomId!);
        broadcastGameShellState(io, response.data.state);
      }

      sendGameResponse(callback, response);
    } catch {
      sendGameInternalError(callback);
    }
  });
}

export function registerGameShellStartFromLobbyHandler(io: Server, socket: Socket): void {
  socket.on(
    GAME_SHELL_START_FROM_LOBBY_EVENT,
    async (payload: unknown, callback) => {
      const contextError = getGameSocketContext(socket);

      if (contextError) {
        sendGameResponse(callback, contextError);
        return;
      }

      const validation = validateStartGameShellFromLobbyPayload(payload);

      if (!validation.success) {
        sendGameResponse(callback, validation);
        return;
      }

      const { playerId, roomId } = socket.data;

      try {
        setRoomRoundCategory(roomId!, validation.data.categoryId);

        if (validation.data.gameId === TIMING_CHALLENGE_GAME_ID) {
          const settingsResult = applyTimingChallengeLobbySettings(
            roomId!,
            validation.data.timingChallenge,
          );

          if (!settingsResult.success) {
            sendGameResponse(callback, {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: settingsResult.error,
              },
            });
            return;
          }
        }

        if (validation.data.gameId === GUESSING_CHALLENGE_GAME_ID) {
          const settingsResult = applyGuessingChallengeLobbySettings(
            roomId!,
            validation.data.guessingChallenge,
          );

          if (!settingsResult.success) {
            sendGameResponse(callback, {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: settingsResult.error,
              },
            });
            return;
          }
        }

        const response = await startGameShellFromLobby(
          roomId!,
          playerId!,
          validation.data.gameId,
        );

        if (response.success) {
          console.info('[game-restart]', {
            stage: 'shell-created',
            roomId,
            shellId: response.data.state.shellId,
            gameId: response.data.state.gameId,
            phase: response.data.state.phase,
          });
          logGameShellDiagnostic('shell-created', {
            roomId,
            shellId: response.data.state.shellId,
            gameId: response.data.state.gameId,
            phase: response.data.state.phase,
          });
          stopGameShellTimer(roomId!);
          broadcastGameShellState(io, response.data.state);
          navigateRoomToGame(io, roomId!);
          scheduleGameShellLifecycle(io, roomId!, response.data.state.shellId);
          console.info('[game-restart]', {
            stage: 'waiting-scheduled',
            roomId,
            shellId: response.data.state.shellId,
          });
        }

        sendGameResponse(callback, response);
      } catch {
        sendGameInternalError(callback);
      }
    },
  );
}

export function registerGameShellReturnToLobbyHandler(io: Server, socket: Socket): void {
  socket.on(GAME_SHELL_RETURN_TO_LOBBY_EVENT, async (_payload: unknown, callback) => {
    const contextError = getGameSocketContext(socket);

    if (contextError) {
      sendGameResponse(callback, contextError);
      return;
    }

    const { playerId, roomId } = socket.data;

    try {
      const response = await returnGameShellToLobby(roomId!, playerId!);

      if (response.success) {
        cleanupGameShellRuntime(roomId!);
        await broadcastRoomPlayersSnapshot(io, roomId!);
        navigateRoomToLobby(io, roomId!);
        console.info('[room-lifecycle]', {
          stage: 'return-to-lobby',
          roomId,
          playerId,
        });
      }

      sendGameResponse(callback, response);
    } catch {
      sendGameInternalError(callback);
    }
  });
}
