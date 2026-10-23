'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MostLikelyToPlayerView } from '@wanasatna/shared';
import {
  MOST_LIKELY_TO_ADVANCE_EVENT,
  MOST_LIKELY_TO_PHASE_CHANGED_EVENT,
  MOST_LIKELY_TO_SYNC_EVENT,
  MOST_LIKELY_TO_VOTE_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: MostLikelyToPlayerView };

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function useMostLikelyToPlayerView(enabled: boolean) {
  const [view, setView] = useState<MostLikelyToPlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasView = useRef(false);

  const sync = useCallback(async () => {
    if (!enabled) return;
    if (!hasView.current) setLoading(true);
    const response = await emitPluginWithAck<ViewResponse>(MOST_LIKELY_TO_SYNC_EVENT, {});
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
    return bindPluginViewResync(getRoomSocket(), MOST_LIKELY_TO_PHASE_CHANGED_EVENT, sync);
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
