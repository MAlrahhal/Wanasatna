'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OneWordOnlyPlayerView } from '@wanasatna/shared';
import {
  ONE_WORD_ONLY_ADVANCE_EVENT,
  ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT,
  ONE_WORD_ONLY_PHASE_CHANGED_EVENT,
  ONE_WORD_ONLY_SUBMIT_CLUE_EVENT,
  ONE_WORD_ONLY_SYNC_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: OneWordOnlyPlayerView };

export function useOneWordOnlyPlayerView(enabled: boolean) {
  const [view, setView] = useState<OneWordOnlyPlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasView = useRef(false);

  const sync = useCallback(async () => {
    if (!enabled) return;
    if (!hasView.current) setLoading(true);
    const response = await emitPluginWithAck<ViewResponse>(ONE_WORD_ONLY_SYNC_EVENT, {});
    if (response.success) {
      hasView.current = true;
      setView(response.data.view);
      setError(null);
    } else if (!hasView.current) setError(response.error.message);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      hasView.current = false;
      return;
    }
    return bindPluginViewResync(getRoomSocket(), ONE_WORD_ONLY_PHASE_CHANGED_EVENT, sync);
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
      } else setError(response.error.message);
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
    submitClue: (clue: string) =>
      view
        ? action(ONE_WORD_ONLY_SUBMIT_CLUE_EVENT, { roundId: view.roundId, clue })
        : Promise.resolve(false),
    confirmAnswer: (optionId: string) =>
      view
        ? action(ONE_WORD_ONLY_CONFIRM_ANSWER_EVENT, {
            roundId: view.roundId,
            optionId,
            requestId: crypto.randomUUID(),
          })
        : Promise.resolve(false),
    advance: () =>
      view
        ? action(ONE_WORD_ONLY_ADVANCE_EVENT, {
            roundId: view.roundId,
            requestId: crypto.randomUUID(),
          })
        : Promise.resolve(false),
  };
}
