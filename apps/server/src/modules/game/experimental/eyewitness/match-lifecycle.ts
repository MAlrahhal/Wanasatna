import type { Server } from 'socket.io';
import { teardownShellAndReturnToLobby } from '../../game.lifecycle.js';
import { persistCompletedMatchThen } from '../../runtime/persist-completed-match.js';
import { clearEyewitnessLobbySettings } from './lobby-settings.js';
import { clearEyewitnessTimerRuntime } from './phase-timer.js';
import { deleteEyewitnessMatch, getEyewitnessMatch } from './store.js';

export function cleanupEyewitnessRuntime(roomId: string): void {
  clearEyewitnessTimerRuntime(roomId);
  deleteEyewitnessMatch(roomId);
  clearEyewitnessLobbySettings(roomId);
}

export function completeEyewitnessMatchLifecycle(io: Server, roomId: string): void {
  if (!getEyewitnessMatch(roomId)) return;
  void persistCompletedMatchThen(roomId, () => {
    cleanupEyewitnessRuntime(roomId);
    teardownShellAndReturnToLobby(io, roomId);
  });
}
