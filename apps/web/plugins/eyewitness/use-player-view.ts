'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EyewitnessPlayerView } from '@wanasatna/shared';
import {
  EYEWITNESS_ADVANCE_EVENT,
  EYEWITNESS_CLEAR_CANVAS_EVENT,
  EYEWITNESS_CONFIRM_VOTE_EVENT,
  EYEWITNESS_PHASE_CHANGED_EVENT,
  EYEWITNESS_STROKE_EVENT,
  EYEWITNESS_STROKE_POINTS_EVENT,
  EYEWITNESS_SUBMIT_ARTWORK_EVENT,
  EYEWITNESS_SUBMIT_DESCRIPTION_EVENT,
  EYEWITNESS_SYNC_EVENT,
  EYEWITNESS_UNDO_EVENT,
  EYEWITNESS_UPDATE_DESCRIPTION_EVENT,
} from '@wanasatna/shared';
import {
  AckGenerationGate,
  isRateLimitedPluginSyncResult,
  runLatestAck,
} from '@/lib/game-plugins/ack-generation';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: EyewitnessPlayerView };

async function fetchPlayerView(): Promise<{
  view: EyewitnessPlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<ViewResponse>(EYEWITNESS_SYNC_EVENT, {});
  return response.success
    ? { view: response.data.view, errorMessage: null }
    : { view: null, errorMessage: response.error.message };
}

export function useEyewitnessPlayerView(enabled: boolean) {
  const [view, setView] = useState<EyewitnessPlayerView | null>(null);
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
    } else if (isInitialLoad) setError(result.errorMessage);
    if (isInitialLoad) setLoading(false);
  }, [enabled]);

  useEffect(() => {
    const gate = syncGate.current;
    if (!enabled) {
      gate.invalidate();
      hasView.current = false;
      return;
    }
    const unbind = bindPluginViewResync(getRoomSocket(), EYEWITNESS_PHASE_CHANGED_EVENT, sync);
    return () => {
      gate.invalidate();
      hasView.current = false;
      unbind();
    };
  }, [enabled, sync]);

  const action = useCallback(
    async (event: string, payload: unknown, quiet = false) => {
      if (!enabled || (submitting && !quiet)) return false;
      if (!quiet) setSubmitting(true);
      setError(null);
      const response = await emitPluginWithAck<ViewResponse>(event, payload);
      if (response.success) {
        if (response.data && 'view' in response.data) {
          setView(response.data.view);
          hasView.current = true;
        }
      } else setError(response.error.message);
      if (!quiet) setSubmitting(false);
      return response.success;
    },
    [enabled, submitting],
  );

  const quietAction = useCallback(
    async (event: string, payload: unknown) => {
      if (!enabled) return false;
      const response = await emitPluginWithAck<{ ok?: true; view?: EyewitnessPlayerView }>(
        event,
        payload,
      );
      if (!response.success) {
        setError(response.error.message);
        return false;
      }
      if (response.data.view) setView(response.data.view);
      return true;
    },
    [enabled],
  );

  return {
    view,
    error,
    loading,
    submitting,
    saveDescription: (description: string) =>
      view
        ? action(EYEWITNESS_UPDATE_DESCRIPTION_EVENT, { roundId: view.roundId, description }, true)
        : Promise.resolve(false),
    submitDescription: (description: string) =>
      view
        ? action(EYEWITNESS_SUBMIT_DESCRIPTION_EVENT, { roundId: view.roundId, description })
        : Promise.resolve(false),
    strokeStart: (payload: Record<string, unknown>) =>
      view
        ? quietAction(EYEWITNESS_STROKE_EVENT, { turnId: view.roundId, ...payload })
        : Promise.resolve(false),
    strokePoints: (payload: Record<string, unknown>) =>
      view
        ? quietAction(EYEWITNESS_STROKE_POINTS_EVENT, { turnId: view.roundId, ...payload })
        : Promise.resolve(false),
    strokeEnd: (strokeId: string) =>
      view
        ? quietAction(EYEWITNESS_STROKE_EVENT, { turnId: view.roundId, strokeId, points: [] })
        : Promise.resolve(false),
    clearCanvas: () =>
      view
        ? action(EYEWITNESS_CLEAR_CANVAS_EVENT, { roundId: view.roundId })
        : Promise.resolve(false),
    undo: () =>
      view ? action(EYEWITNESS_UNDO_EVENT, { roundId: view.roundId }) : Promise.resolve(false),
    submitArtwork: () =>
      view
        ? action(EYEWITNESS_SUBMIT_ARTWORK_EVENT, { roundId: view.roundId })
        : Promise.resolve(false),
    confirmVote: (artworkId: string) =>
      view
        ? action(EYEWITNESS_CONFIRM_VOTE_EVENT, { roundId: view.roundId, artworkId })
        : Promise.resolve(false),
    advance: () =>
      view
        ? action(EYEWITNESS_ADVANCE_EVENT, {
            roundId: view.roundId,
            requestId: crypto.randomUUID(),
          })
        : Promise.resolve(false),
  };
}
