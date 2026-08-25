import { completePersistedMatch } from '../../match/match-history.service.js';
import { opsLogger } from '../../../lib/ops-logger.js';
import { getGameShellByRoomId } from '../game.service.js';
import { collectMatchHistoryResults } from './match-history-results.js';
import type { Server } from 'socket.io';
import {
  activateMarathonTransition,
  recordCompletedMarathonLeg,
} from '../../marathon/marathon.runtime.js';
import { getMarathonState } from '../../marathon/marathon.store.js';

/**
 * Snapshot final scores from in-memory plugin state, then run the existing
 * shell teardown immediately. History write is best-effort and must not delay
 * lobby return or live-game cleanup.
 */
export function persistCompletedMatchThen(roomId: string, teardown: () => void, io?: Server): void {
  const shell = getGameShellByRoomId(roomId);
  const results = collectMatchHistoryResults(roomId, shell?.gameId ?? null);
  const marathon = getMarathonState(roomId);

  if (io && marathon?.status === 'PLAYING' && shell?.shellId === marathon.activeShellId) {
    void (async () => {
      await completePersistedMatch(roomId, results);
      const transition = recordCompletedMarathonLeg(roomId, shell.shellId, results);
      teardown();
      if (transition) {
        activateMarathonTransition(io, transition);
      }
    })().catch((error) => {
      opsLogger.error('match-history-write-failed', 'تعذر إكمال مرحلة الماراتون.', {
        stage: 'marathon-complete-failed',
        roomId,
        errorName: error instanceof Error ? error.name : typeof error,
      });
    });
    return;
  }

  teardown();
  void completePersistedMatch(roomId, results).catch((error) => {
    opsLogger.error('match-history-write-failed', 'تعذر حفظ سجل المباراة.', {
      stage: 'complete-failed',
      roomId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
  });
}
