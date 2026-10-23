import type { Server } from 'socket.io';
import { teardownShellAndReturnToLobby } from '../../game.lifecycle.js';
import { persistCompletedMatchThen } from '../../runtime/persist-completed-match.js';
import { clearTimelinePlacementLobbySettings } from './lobby-settings.js';
import { clearTimelinePlacementTimerRuntime } from './phase-timer.js';
import { deleteTimelinePlacementMatch, getTimelinePlacementMatch } from './store.js';

export function cleanupTimelinePlacementRuntime(roomId: string): void {
  clearTimelinePlacementTimerRuntime(roomId);
  deleteTimelinePlacementMatch(roomId);
  clearTimelinePlacementLobbySettings(roomId);
}

export function completeTimelinePlacementMatch(io: Server, roomId: string): void {
  if (!getTimelinePlacementMatch(roomId)) return;
  void persistCompletedMatchThen(roomId, () => {
    cleanupTimelinePlacementRuntime(roomId);
    teardownShellAndReturnToLobby(io, roomId);
  });
}
