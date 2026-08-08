import type { Server } from 'socket.io';
import type { GameShellAbortReason, GameShellState } from '@wanasatna/shared';
import { GAME_SHELL_NAVIGATE_EVENT, GAME_SHELL_STATE_EVENT } from '@wanasatna/shared';
import { getRoomChannel } from '../room/room.utils.js';
import {
  applyCountdownTick,
  applyGameTimerTick,
  getGameShellByRoomId,
} from './game.service.js';
import { logGameShellDiagnostic } from './game.diagnostics.js';
import { initializePluginOnPlaying } from './runtime/initialize-plugin-on-playing.js';

type TimerKind = 'countdown' | 'game';

type ActiveTimer = {
  kind: TimerKind;
  intervalId: ReturnType<typeof setInterval>;
};

const timersByRoomId = new Map<string, ActiveTimer>();

export function hasGameShellTimer(roomId: string): boolean {
  return timersByRoomId.has(roomId);
}

export function broadcastGameShellState(io: Server, state: GameShellState): void {
  io.to(getRoomChannel(state.roomId)).emit(GAME_SHELL_STATE_EVENT, { state });
}

export function broadcastGameShellNavigate(
  io: Server,
  roomId: string,
  path: '/game' | '/lobby',
  options?: {
    roomCode?: string;
    reason?: GameShellAbortReason;
    message?: string;
  },
): void {
  io.to(getRoomChannel(roomId)).emit(GAME_SHELL_NAVIGATE_EVENT, {
    path,
    roomId,
    roomCode: options?.roomCode,
    reason: options?.reason,
    message: options?.message,
  });
}

export function stopGameShellTimer(roomId: string): void {
  const activeTimer = timersByRoomId.get(roomId);

  if (!activeTimer) {
    return;
  }

  clearInterval(activeTimer.intervalId);
  timersByRoomId.delete(roomId);
  logGameShellDiagnostic('timer-stopped', { roomId, kind: activeTimer.kind });
}

export function startGameShellTimer(io: Server, roomId: string, kind: TimerKind): void {
  stopGameShellTimer(roomId);
  logGameShellDiagnostic('timer-started', { roomId, kind });

  const intervalId = setInterval(() => {
    const shell = getGameShellByRoomId(roomId);

    if (!shell) {
      stopGameShellTimer(roomId);
      return;
    }

    const nextState =
      kind === 'countdown' ? applyCountdownTick(roomId) : applyGameTimerTick(roomId);

    if (!nextState) {
      stopGameShellTimer(roomId);
      return;
    }

    broadcastGameShellState(io, nextState);

    if (kind === 'countdown' && nextState.phase !== 'COUNTDOWN') {
      stopGameShellTimer(roomId);

      if (nextState.phase === 'PLAYING') {
        // Plugin-managed games (gameId set) own their match lifecycle and end
        // through match-completed; the generic game timer would force-finish
        // the shell mid-match, so it only runs for plain shells.
        if (!nextState.gameId) {
          startGameShellTimer(io, roomId, 'game');
        }

        void initializePluginOnPlaying(io, roomId).catch((error) => {
          logGameShellDiagnostic('plugin-init-rejected', {
            roomId,
            trigger: 'countdown-timer',
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      return;
    }

    if (kind === 'game' && nextState.phase !== 'PLAYING') {
      stopGameShellTimer(roomId);
    }
  }, 1000);

  timersByRoomId.set(roomId, { kind, intervalId });
}

export function clearGameShellRuntime(roomId: string): void {
  stopGameShellTimer(roomId);
}
