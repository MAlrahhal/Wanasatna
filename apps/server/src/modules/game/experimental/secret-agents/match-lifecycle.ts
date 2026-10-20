import type { Server } from 'socket.io';
import { teardownShellAndReturnToLobby } from '../../game.lifecycle.js';
import { persistCompletedMatchThen } from '../../runtime/persist-completed-match.js';
import { clearSecretAgentsLobbyState } from './lobby-state.js';
import { clearSecretAgentsTimerRuntime } from './phase-timer.js';
import { deleteSecretAgentsMatch, getSecretAgentsMatch } from './store.js';

export function cleanupSecretAgentsRuntime(roomId: string): void {
  clearSecretAgentsTimerRuntime(roomId);
  deleteSecretAgentsMatch(roomId);
  clearSecretAgentsLobbyState(roomId);
}

export function completeSecretAgentsMatch(io: Server, roomId: string): void {
  if (!getSecretAgentsMatch(roomId)) return;
  void persistCompletedMatchThen(roomId, () => {
    cleanupSecretAgentsRuntime(roomId);
    teardownShellAndReturnToLobby(io, roomId);
  });
}
