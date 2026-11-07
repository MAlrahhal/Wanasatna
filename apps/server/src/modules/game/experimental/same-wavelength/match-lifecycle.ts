import type { Server } from 'socket.io';
import { teardownShellAndReturnToLobby } from '../../game.lifecycle.js';
import { persistCompletedMatchThen } from '../../runtime/persist-completed-match.js';
import { clearSameWavelengthLobbyState } from './lobby-state.js';
import { clearSameWavelengthTimerRuntime } from './phase-timer.js';
import { deleteSameWavelengthMatch, getSameWavelengthMatch } from './store.js';

export function cleanupSameWavelengthRuntime(roomId: string): void {
  clearSameWavelengthTimerRuntime(roomId);
  deleteSameWavelengthMatch(roomId);
  clearSameWavelengthLobbyState(roomId);
}

export function completeSameWavelengthMatch(io: Server, roomId: string): void {
  if (!getSameWavelengthMatch(roomId)) return;
  void persistCompletedMatchThen(roomId, () => {
    cleanupSameWavelengthRuntime(roomId);
    teardownShellAndReturnToLobby(io, roomId);
  });
}
