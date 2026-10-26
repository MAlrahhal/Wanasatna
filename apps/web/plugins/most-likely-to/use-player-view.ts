'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MostLikelyToPlayerView } from '@wanasatna/shared';
import {
  MOST_LIKELY_TO_ADVANCE_EVENT,
  MOST_LIKELY_TO_PHASE_CHANGED_EVENT,
  MOST_LIKELY_TO_SYNC_EVENT,
  MOST_LIKELY_TO_VOTE_EVENT,
} from '@wanasatna/shared';
import {
  AckGenerationGate,
  isRateLimitedPluginSyncResult,
  runLatestAck,
} from '@/lib/game-plugins/ack-generation';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: MostLikelyToPlayerView };

async function fetchPlayerView(): Promise<{
  view: MostLikelyToPlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<ViewResponse>(MOST_LIKELY_TO_SYNC_EVENT, {});
  return response.success
    ? { view: response.data.view, errorMessage: null }
    : { view: null, errorMessage: response.error.message };
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function useMostLikelyToPlayerView(enabled: boolean) {
  const [view, setView] = useState<MostLikelyToPlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasView = useRef(false);
  const syncGate = useRef(new AckGenerationGate());

  const sync = useCallback(async () => {
    if (!enabled) return;
    const isInitialLoad = !hasView.current;
    if (isInitialLoad) setLoading(true);
    const result = await runLatestAck(
      syncGate.current,
      fetchPlayerView,
      isRateLimitedPluginSyncResult,
    );
    if (result === undefined) return;
    if (result.view) {
      hasView.current = true;
      setView(result.view);
      setError(null);
    } else if (isRateLimitedPluginSyncResult(result)) {
      return 'rate-limited';
    } else if (isInitialLoad) {
      setError(result.errorMessage);
    }
    if (isInitialLoad) setLoading(false);
  }, [enabled]);

  useEffect(() => {
    const gate = syncGate.current;
    if (!enabled) {
      gate.invalidate();
      hasView.current = false;
      return;
    }
    const unbind = bindPluginViewResync(getRoomSocket(), MOST_LIKELY_TO_PHASE_CHANGED_EVENT, sync);
    return () => {
      gate.invalidate();
      hasView.current = false;
      unbind();
    };
  }, [enabled, sync]);

  const action = useCallback(
    async (event: string, payload: unknown) => {
      if (!enabled || submitting) return false;
      setSubmitting(true);
      setError(null);
      const response = await emitPluginWithAck<ViewResponse>(event, payload);
      if (response.success) {
        hasView.current = true;
        setView(response.data.view);
      } else {
        setError(response.error.message);
      }
      setSubmitting(false);
      return response.success;
    },
    [enabled, submitting],
  );

  return {
    view,
    error,
    loading,
    submitting,
    vote: (nomineePlayerId: string) =>
      view
        ? action(MOST_LIKELY_TO_VOTE_EVENT, {
            questionId: view.questionId,
            nomineePlayerId,
            requestId: requestId(),
          })
        : Promise.resolve(false),
    advance: () =>
      view
        ? action(MOST_LIKELY_TO_ADVANCE_EVENT, {
            questionId: view.questionId,
            requestId: requestId(),
          })
        : Promise.resolve(false),
  };
}
