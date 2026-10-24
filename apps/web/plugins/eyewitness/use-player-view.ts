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
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: EyewitnessPlayerView };

export function useEyewitnessPlayerView(enabled: boolean) {
  const [view, setView] = useState<EyewitnessPlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasView = useRef(false);

  const sync = useCallback(async () => {
    if (!enabled) return;
    if (!hasView.current) setLoading(true);
    const response = await emitPluginWithAck<ViewResponse>(EYEWITNESS_SYNC_EVENT, {});
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
    return bindPluginViewResync(getRoomSocket(), EYEWITNESS_PHASE_CHANGED_EVENT, sync);
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
