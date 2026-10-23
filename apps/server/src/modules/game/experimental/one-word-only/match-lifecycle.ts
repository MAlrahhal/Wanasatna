import type { Server } from 'socket.io';
import { teardownShellAndReturnToLobby } from '../../game.lifecycle.js';
import { persistCompletedMatchThen } from '../../runtime/persist-completed-match.js';
import { clearOneWordOnlyLobbySettings } from './lobby-settings.js';
import { clearOneWordOnlyTimerRuntime } from './phase-timer.js';
import { deleteOneWordOnlyMatch, getOneWordOnlyMatch } from './store.js';

export function cleanupOneWordOnlyRuntime(roomId: string): void {
  clearOneWordOnlyTimerRuntime(roomId);
  deleteOneWordOnlyMatch(roomId);
  clearOneWordOnlyLobbySettings(roomId);
}

export function completeOneWordOnlyMatch(io: Server, roomId: string): void {
  if (!getOneWordOnlyMatch(roomId)) return;
  void persistCompletedMatchThen(roomId, () => {
    cleanupOneWordOnlyRuntime(roomId);
    teardownShellAndReturnToLobby(io, roomId);
  });
}
