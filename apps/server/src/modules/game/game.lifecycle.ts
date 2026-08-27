import type { Server } from 'socket.io';
import type { GameShellAbortReason } from '@wanasatna/shared';
import {
  advanceShellToCountdownFromLobby,
  deleteGameShell,
  getGameShellByRoomId,
} from './game.service.js';
import { resolveLobbyWaitMs } from '../../config/test-timers.js';
import { logGameShellDiagnostic } from './game.diagnostics.js';
import {
  broadcastGameShellNavigate,
  broadcastGameShellState,
  hasGameShellTimer,
  startGameShellTimer,
  stopGameShellTimer,
} from './game.timer.js';
import { initializePluginOnPlaying } from './runtime/initialize-plugin-on-playing.js';
import { broadcastRoomPlayersSnapshot } from '../room/room.utils.js';
import { clearRoomSpectatorFlags } from '../room/services/clear-spectators.service.js';
import { getMarathonState } from '../marathon/marathon.store.js';

type LobbyWaitSchedule = {
  timeoutId: ReturnType<typeof setTimeout>;
  shellId: string;
  scheduledAt: number;
};

const lobbyWaitTimeouts = new Map<string, LobbyWaitSchedule>();

export function clearLobbyWaitTimeout(roomId: string): void {
  const schedule = lobbyWaitTimeouts.get(roomId);

  if (!schedule) {
    return;
  }

  clearTimeout(schedule.timeoutId);
  lobbyWaitTimeouts.delete(roomId);
}

async function advanceToCountdownAndBroadcast(
  io: Server,
  roomId: string,
  shellId: string,
  trigger: 'scheduled-callback' | 'sync-recovery',
): Promise<void> {
  const response = await advanceShellToCountdownFromLobby(roomId, shellId);

  if (!response.success) {
    logGameShellDiagnostic('countdown-transition-failed', {
      roomId,
      shellId,
      trigger,
      errorCode: response.error.code,
      errorMessage: response.error.message,
    });

    const shell = getGameShellByRoomId(roomId);

    if (shell) {
      broadcastGameShellState(io, shell);
    }

    return;
  }

  logGameShellDiagnostic('countdown-transition-succeeded', {
    roomId,
    shellId,
    trigger,
    phase: response.data.state.phase,
  });

  broadcastGameShellState(io, response.data.state);

  if (response.data.state.phase === 'COUNTDOWN' && !hasGameShellTimer(roomId)) {
    startGameShellTimer(io, roomId, 'countdown');
    console.info('[game-restart]', {
      stage: 'countdown-entered',
      roomId,
      shellId,
      trigger,
    });
  }
}

/**
 * Explicit rejection boundary for the detached lobby→countdown transition.
 * Keeps the room in a safe WAITING state (self-healed by the next shell sync)
 * and guarantees the rejection never escapes as an unhandled rejection.
 */
function runCountdownTransition(
  io: Server,
  roomId: string,
  shellId: string,
  trigger: 'scheduled-callback' | 'sync-recovery',
): void {
  void advanceToCountdownAndBroadcast(io, roomId, shellId, trigger).catch((error) => {
    logGameShellDiagnostic('countdown-transition-rejected', {
      roomId,
      shellId,
      trigger,
      error: error instanceof Error ? error.message : String(error),
    });

    clearLobbyWaitTimeout(roomId);

    const shell = getGameShellByRoomId(roomId);

    if (shell) {
      broadcastGameShellState(io, shell);
    }
  });
}

export function scheduleGameShellLifecycle(io: Server, roomId: string, shellId: string): void {
  clearLobbyWaitTimeout(roomId);

  const timeoutId = setTimeout(() => {
    lobbyWaitTimeouts.delete(roomId);
    logGameShellDiagnostic('lifecycle-callback-fired', { roomId, shellId });
    runCountdownTransition(io, roomId, shellId, 'scheduled-callback');
  }, resolveLobbyWaitMs());

  lobbyWaitTimeouts.set(roomId, { timeoutId, shellId, scheduledAt: Date.now() });
  logGameShellDiagnostic('lifecycle-scheduled', {
    roomId,
    shellId,
    delayMs: resolveLobbyWaitMs(),
  });
}

/**
 * Recovery entry point: ensures a lobby-started shell is not stuck.
 *
 * Shells with a gameId are always created through the integrated lobby flow,
 * so a WAITING shell with a gameId and no pending schedule means the scheduled
 * callback was lost (cleared, raced, or the process restarted mid-window).
 * Also restores missing countdown/game timers after any interruption.
 *
 * Called from the shell sync and room reconnect handlers, so any client
 * landing on /game or reconnecting will self-heal the room's lifecycle.
 */
export function ensureGameShellLifecycleProgress(io: Server, roomId: string): void {
  const shell = getGameShellByRoomId(roomId);

  if (!shell) {
    return;
  }

  if (shell.phase === 'WAITING' && shell.gameId) {
    const schedule = lobbyWaitTimeouts.get(roomId);

    if (schedule && schedule.shellId === shell.shellId) {
      return;
    }

    logGameShellDiagnostic('lifecycle-recovery-advance', {
      roomId,
      shellId: shell.shellId,
      hadStaleSchedule: Boolean(schedule),
    });
    clearLobbyWaitTimeout(roomId);
    runCountdownTransition(io, roomId, shell.shellId, 'sync-recovery');
    return;
  }

  if (shell.phase === 'COUNTDOWN' && !hasGameShellTimer(roomId)) {
    logGameShellDiagnostic('lifecycle-recovery-countdown-timer', {
      roomId,
      shellId: shell.shellId,
    });
    startGameShellTimer(io, roomId, 'countdown');
    return;
  }

  if (shell.phase === 'PLAYING') {
    if (!shell.gameId) {
      if (!hasGameShellTimer(roomId)) {
        logGameShellDiagnostic('lifecycle-recovery-game-timer', {
          roomId,
          shellId: shell.shellId,
        });
        startGameShellTimer(io, roomId, 'game');
      }

      return;
    }

    // Plugin-managed games never run the generic game timer; make sure the
    // plugin match state and its phase timer exist (idempotent).
    const shellIdForInit = shell.shellId;
    void initializePluginOnPlaying(io, roomId, shellIdForInit).catch((error) => {
      logGameShellDiagnostic('plugin-init-rejected', {
        roomId,
        trigger: 'lifecycle-recovery',
        shellId: shellIdForInit,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

export function navigateRoomToGame(io: Server, roomId: string): void {
  broadcastGameShellNavigate(io, roomId, '/game');
}

export function navigateRoomToLobby(
  io: Server,
  roomId: string,
  options?: {
    roomCode?: string;
    reason?: GameShellAbortReason;
    message?: string;
  },
): void {
  broadcastGameShellNavigate(io, roomId, '/lobby', options);
}

export async function returnRoomToLobbyAfterMatch(
  io: Server,
  roomId: string,
  options?: {
    roomCode?: string;
    reason?: GameShellAbortReason;
    message?: string;
  },
): Promise<void> {
  try {
    await clearRoomSpectatorFlags(roomId);
  } catch (error) {
    console.error('[room-lifecycle]', {
      stage: 'clear-spectators-failed',
      roomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await broadcastRoomPlayersSnapshot(io, roomId);
  } catch (error) {
    console.error('[room-lifecycle]', {
      stage: 'lobby-roster-broadcast-failed',
      roomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  navigateRoomToLobby(io, roomId, options);
}

/** Authoritative match teardown: drop the shell, clear spectators, then lobby. */
export function teardownShellAndReturnToLobby(
  io: Server,
  roomId: string,
  options?: {
    roomCode?: string;
    reason?: GameShellAbortReason;
    message?: string;
  },
): void {
  const marathonStatus = getMarathonState(roomId)?.status;
  if (marathonStatus === 'TRANSITION' || marathonStatus === 'FINISHED') {
    cleanupGameShellRuntime(roomId);
    deleteGameShell(roomId);
    return;
  }
  cleanupGameShellRuntime(roomId);
  deleteGameShell(roomId);
  void returnRoomToLobbyAfterMatch(io, roomId, options);
}

export function cleanupGameShellRuntime(roomId: string): void {
  clearLobbyWaitTimeout(roomId);
  stopGameShellTimer(roomId);
}
