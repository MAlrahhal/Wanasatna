'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelinePlacementPlayerView } from '@wanasatna/shared';
import {
  TIMELINE_PLACEMENT_CHOOSE_EVENT,
  TIMELINE_PLACEMENT_CONTINUE_EVENT,
  TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT,
  TIMELINE_PLACEMENT_SYNC_EVENT,
} from '@wanasatna/shared';
import {
  AckGenerationGate,
  isRateLimitedPluginSyncResult,
  runLatestAck,
} from '@/lib/game-plugins/ack-generation';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: TimelinePlacementPlayerView };

async function fetchPlayerView(): Promise<{
  view: TimelinePlacementPlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<ViewResponse>(TIMELINE_PLACEMENT_SYNC_EVENT);
  return response.success
    ? { view: response.data.view, errorMessage: null }
    : { view: null, errorMessage: response.error.message };
}

export function useTimelinePlacementPlayerView(enabled: boolean) {
  const [view, setView] = useState<TimelinePlacementPlayerView | null>(null);
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
    const unbind = bindPluginViewResync(
      getRoomSocket(),
      TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT,
      sync,
    );
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
        setView(response.data.view);
        hasView.current = true;
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
    chooseGap: (gapId: string) =>
      view
        ? action(TIMELINE_PLACEMENT_CHOOSE_EVENT, { roundId: view.roundId, gapId })
        : Promise.resolve(false),
    continueRound: () =>
      view
        ? action(TIMELINE_PLACEMENT_CONTINUE_EVENT, { roundId: view.roundId })
        : Promise.resolve(false),
  };
}
