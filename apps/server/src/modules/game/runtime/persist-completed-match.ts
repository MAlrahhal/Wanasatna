import { completePersistedMatch } from '../../match/match-history.service.js';
import { getGameShellByRoomId } from '../game.service.js';
import { collectMatchHistoryResults } from './match-history-results.js';

/**
 * Snapshot final scores from in-memory plugin state, then run the existing
 * shell teardown immediately. History write is best-effort and must not delay
 * lobby return or live-game cleanup.
 */
export function persistCompletedMatchThen(roomId: string, teardown: () => void): void {
  const shell = getGameShellByRoomId(roomId);
  const results = collectMatchHistoryResults(roomId, shell?.gameId ?? null);
  teardown();
  void completePersistedMatch(roomId, results).catch((error) => {
    console.error('[match-history]', {
      stage: 'complete-failed',
      roomId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

