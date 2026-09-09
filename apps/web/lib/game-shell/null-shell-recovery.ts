import type { GameShellState } from '@wanasatna/shared';
import { INSUFFICIENT_PLAYERS_ABORT_MESSAGE } from '@wanasatna/shared';
import { buildLobbyUrl } from '@/lib/room/session';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';

export const LOBBY_NOTICE_STORAGE_KEY = 'wanasatna:lobby-notice';
export const LOBBY_LIFECYCLE_NOTICE_DISMISS_MS = 2500;

export type GameShellSyncStatus = 'pending' | 'ready' | 'empty' | 'error';

export type ShellSyncView = {
  status: GameShellSyncStatus;
  state: GameShellState | null;
  errorMessage: string | null;
  generation: number;
};

export function createPendingShellSyncView(generation = 0): ShellSyncView {
  return {
    status: 'pending',
    state: null,
    errorMessage: null,
    generation,
  };
}

/** Live GAME_SHELL_STATE invalidates in-flight SYNC so a stale null cannot win. */
export function applyLiveShellState(
  current: ShellSyncView,
  state: GameShellState | null,
): ShellSyncView {
  if (!state) {
    return {
      status: 'empty',
      state: null,
      errorMessage: null,
      generation: current.generation + 1,
    };
  }

  return {
    status: 'ready',
    state,
    errorMessage: null,
    generation: current.generation + 1,
  };
}

export function beginShellSync(current: ShellSyncView): { requestGeneration: number; view: ShellSyncView } {
  const requestGeneration = current.generation + 1;
  return {
    requestGeneration,
    view: {
      ...current,
      generation: requestGeneration,
      status: current.status === 'ready' ? 'ready' : 'pending',
    },
  };
}

export function applyShellSyncResponse(input: {
  requestGeneration: number;
  current: ShellSyncView;
  response:
    | { success: true; state: GameShellState | null }
    | { success: false; code: string; message: string };
}): ShellSyncView {
  if (input.requestGeneration !== input.current.generation) {
    return input.current;
  }

  if (!input.response.success) {
    if (input.current.status === 'ready') {
      return input.response.code === 'RATE_LIMITED'
        ? input.current
        : {
            ...input.current,
            errorMessage: input.response.message,
          };
    }

    return {
      ...input.current,
      status: 'error',
      errorMessage: input.response.message,
    };
  }

  if (input.response.state) {
    return {
      status: 'ready',
      state: input.response.state,
      errorMessage: null,
      generation: input.current.generation,
    };
  }

  return {
    status: 'empty',
    state: null,
    errorMessage: null,
    generation: input.current.generation,
  };
}

export function shouldRecoverGameRouteToLobby(
  pathname: string,
  status: GameShellSyncStatus,
): boolean {
  return pathname === '/game' && status === 'empty';
}

export function planNullShellLobbyRecovery(input: {
  pathname: string;
  syncStatus: GameShellSyncStatus;
  roomCode: string | null | undefined;
}): { recover: false } | { recover: true; lobbyUrl: string; notice: string } {
  if (!shouldRecoverGameRouteToLobby(input.pathname, input.syncStatus) || !input.roomCode) {
    return { recover: false };
  }

  return {
    recover: true,
    lobbyUrl: buildLobbyUrl(input.roomCode),
    notice: SYSTEM_COPY.gameEndedReturnLobby,
  };
}

export function isLobbyLifecycleNotice(message: string | null | undefined): boolean {
  return (
    message === SYSTEM_COPY.gameEndedReturnLobby || message === INSUFFICIENT_PLAYERS_ABORT_MESSAGE
  );
}

export function shouldClearLobbyLifecycleNotice(input: {
  notice: string | null;
  roomStatus: string;
  wasReconnecting: boolean;
  hasActiveShell: boolean;
}): boolean {
  if (!input.notice || !isLobbyLifecycleNotice(input.notice)) {
    return false;
  }

  if (input.hasActiveShell) {
    return true;
  }

  return input.roomStatus === 'connected' && input.wasReconnecting;
}

export function writeLobbyNotice(message: string): void {
  try {
    const existing = globalThis.sessionStorage.getItem(LOBBY_NOTICE_STORAGE_KEY);
    if (
      existing &&
      isLobbyLifecycleNotice(existing) &&
      existing !== SYSTEM_COPY.gameEndedReturnLobby &&
      message === SYSTEM_COPY.gameEndedReturnLobby
    ) {
      return;
    }
    globalThis.sessionStorage.setItem(LOBBY_NOTICE_STORAGE_KEY, message);
  } catch {
    /* storage unavailable */
  }
}
