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
import { waitForPendingSpectatorPromotionPersistence } from './absorb-spectators-for-next-round.js';
import type { MatchParticipantResult } from '../../match/match-history.types.js';

const pendingMarathonCompletions = new Set<string>();

type PersistCompletedMatchDependencies = {
  waitForPromotions?: (roomId: string) => Promise<void>;
  completeMatch?: (roomId: string, results: MatchParticipantResult[]) => Promise<boolean>;
};

/**
 * Snapshot final scores from in-memory plugin state, then run the existing
 * shell teardown immediately. History write is best-effort and must not delay
 * lobby return or live-game cleanup.
 */
export function persistCompletedMatchThen(
  roomId: string,
  teardown: () => void,
  io?: Server,
  dependencies?: PersistCompletedMatchDependencies,
): Promise<void> {
  const shell = getGameShellByRoomId(roomId);
  const results = collectMatchHistoryResults(roomId, shell?.gameId ?? null);
  const marathon = getMarathonState(roomId);
  const waitForPromotions =
    dependencies?.waitForPromotions ?? waitForPendingSpectatorPromotionPersistence;
  const completeMatch = dependencies?.completeMatch ?? completePersistedMatch;

  if (io && marathon?.status === 'PLAYING' && shell?.shellId === marathon.activeShellId) {
    const completionKey = `${roomId}:${shell.shellId}`;
    if (pendingMarathonCompletions.has(completionKey)) {
      return Promise.resolve();
    }
    pendingMarathonCompletions.add(completionKey);
    return (async () => {
      try {
        await waitForPromotions(roomId);
        await completeMatch(roomId, results);
      } catch (error) {
        opsLogger.error('match-history-write-failed', 'تعذر إكمال مرحلة الماراتون.', {
          stage: 'marathon-complete-failed',
          roomId,
          errorName: error instanceof Error ? error.name : typeof error,
        });
      }
      const transition = recordCompletedMarathonLeg(roomId, shell.shellId, results);
      teardown();
      if (transition) {
        activateMarathonTransition(io, transition);
      }
    })()
      .catch((error) => {
        opsLogger.error('match-history-write-failed', 'Marathon transition failed.', {
          stage: 'marathon-transition-failed',
          roomId,
          errorName: error instanceof Error ? error.name : typeof error,
        });
      })
      .finally(() => pendingMarathonCompletions.delete(completionKey));
  }

  teardown();
  return (async () => {
    try {
      await waitForPromotions(roomId);
      await completeMatch(roomId, results);
    } catch (error) {
      opsLogger.error('match-history-write-failed', 'تعذر حفظ سجل المباراة.', {
        stage: 'complete-failed',
        roomId,
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }
  })();
}
