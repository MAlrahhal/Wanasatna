'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SameWavelengthPlayerView } from '@wanasatna/shared';
import {
  SAME_WAVELENGTH_CONFIRM_EVENT,
  SAME_WAVELENGTH_NEXT_EVENT,
  SAME_WAVELENGTH_PHASE_CHANGED_EVENT,
  SAME_WAVELENGTH_PROPOSE_EVENT,
  SAME_WAVELENGTH_SUBMIT_CLUE_EVENT,
  SAME_WAVELENGTH_SYNC_EVENT,
} from '@wanasatna/shared';
import {
  AckGenerationGate,
  isRateLimitedPluginSyncResult,
  runLatestAck,
} from '@/lib/game-plugins/ack-generation';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: SameWavelengthPlayerView };

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

async function fetchPlayerView() {
  const response = await emitPluginWithAck<ViewResponse>(SAME_WAVELENGTH_SYNC_EVENT);
  return response.success
    ? { view: response.data.view, errorMessage: null }
    : { view: null, errorMessage: response.error.message };
}

export function useSameWavelengthPlayerView(enabled: boolean) {
  const [view, setView] = useState<SameWavelengthPlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasView = useRef(false);
  const syncGate = useRef(new AckGenerationGate());

  const sync = useCallback(async () => {
    if (!enabled) return;
    const initial = !hasView.current;
    if (initial) setLoading(true);
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
    } else if (isRateLimitedPluginSyncResult(result)) return 'rate-limited';
    else if (initial) setError(result.errorMessage);
    if (initial) setLoading(false);
  }, [enabled]);

  useEffect(() => {
    const gate = syncGate.current;
    if (!enabled) {
      gate.invalidate();
      hasView.current = false;
      return;
    }
    const unbind = bindPluginViewResync(getRoomSocket(), SAME_WAVELENGTH_PHASE_CHANGED_EVENT, sync);
    return () => {
      gate.invalidate();
      hasView.current = false;
      unbind();
    };
  }, [enabled, sync]);

  const action = useCallback(
    async (event: string, payload: unknown) => {
      if (!enabled || submitting) return null;
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
      return response.success ? response.data.view : null;
    },
    [enabled, submitting],
  );

  const submitIndividualGuess = useCallback(
    async (position: number) => {
      if (!enabled || submitting || !view || view.mode !== 'individual') return null;
      setSubmitting(true);
      setError(null);

      let latestView = view;
      if (view.ownProposal !== position || view.ownConfirmed) {
        const proposalResponse = await emitPluginWithAck<ViewResponse>(
          SAME_WAVELENGTH_PROPOSE_EVENT,
          {
            turnId: view.turnId,
            position,
            requestId: requestId(),
          },
        );
        if (!proposalResponse.success) {
          setError(proposalResponse.error.message);
          setSubmitting(false);
          return null;
        }
        latestView = proposalResponse.data.view;
        hasView.current = true;
        setView(latestView);
      }

      const confirmResponse = await emitPluginWithAck<ViewResponse>(SAME_WAVELENGTH_CONFIRM_EVENT, {
        turnId: latestView.turnId,
        requestId: requestId(),
      });
      if (confirmResponse.success) {
        hasView.current = true;
        setView(confirmResponse.data.view);
      } else {
        setError(confirmResponse.error.message);
      }
      setSubmitting(false);
      return confirmResponse.success ? confirmResponse.data.view : null;
    },
    [enabled, submitting, view],
  );

  return {
    view,
    error,
    loading,
    submitting,
    submitClue: (clue: string) =>
      view
        ? action(SAME_WAVELENGTH_SUBMIT_CLUE_EVENT, {
            turnId: view.turnId,
            clue,
            requestId: requestId(),
          })
        : Promise.resolve(null),
    propose: (position: number) =>
      view
        ? action(SAME_WAVELENGTH_PROPOSE_EVENT, {
            turnId: view.turnId,
            position,
            requestId: requestId(),
          })
        : Promise.resolve(null),
    submitIndividualGuess,
    confirm: () =>
      view
        ? action(SAME_WAVELENGTH_CONFIRM_EVENT, {
            turnId: view.turnId,
            requestId: requestId(),
          })
        : Promise.resolve(null),
    next: () =>
      view
        ? action(SAME_WAVELENGTH_NEXT_EVENT, {
            turnId: view.turnId,
            requestId: requestId(),
          })
        : Promise.resolve(null),
  };
}
