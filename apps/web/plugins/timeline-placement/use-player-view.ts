'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelinePlacementPlayerView } from '@wanasatna/shared';
import {
  TIMELINE_PLACEMENT_CHOOSE_EVENT,
  TIMELINE_PLACEMENT_CONTINUE_EVENT,
  TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT,
  TIMELINE_PLACEMENT_SYNC_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: TimelinePlacementPlayerView };

export function useTimelinePlacementPlayerView(enabled: boolean) {
  const [view, setView] = useState<TimelinePlacementPlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasView = useRef(false);

  const sync = useCallback(async () => {
    if (!enabled) return;
    if (!hasView.current) setLoading(true);
    const response = await emitPluginWithAck<ViewResponse>(TIMELINE_PLACEMENT_SYNC_EVENT);
    if (response.success) {
      hasView.current = true;
      setView(response.data.view);
      setError(null);
    } else if (!hasView.current) {
      setError(response.error.message);
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      hasView.current = false;
      return;
    }
    return bindPluginViewResync(getRoomSocket(), TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT, sync);
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
