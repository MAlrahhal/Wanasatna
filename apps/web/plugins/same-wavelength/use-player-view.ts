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
import { shouldAcceptSameWavelengthView } from './view-order';

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
  const actionInFlight = useRef(false);
  const retiredMatchIds = useRef(new Set<string>());

  const applyView = useCallback((incoming: SameWavelengthPlayerView) => {
    setView((current) => {
      if (current && current.matchId !== incoming.matchId) {
        if (retiredMatchIds.current.has(incoming.matchId)) return current;
        retiredMatchIds.current.add(current.matchId);
      }
      return shouldAcceptSameWavelengthView(current, incoming) ? incoming : current;
    });
  }, []);

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
      applyView(result.view);
      setError(null);
    } else if (isRateLimitedPluginSyncResult(result)) return 'rate-limited';
    else if (initial) setError(result.errorMessage);
    if (initial) setLoading(false);
  }, [applyView, enabled]);

  useEffect(() => {
    const gate = syncGate.current;
    const retired = retiredMatchIds.current;
    if (!enabled) {
      gate.invalidate();
      hasView.current = false;
      retired.clear();
      return;
    }
    const unbind = bindPluginViewResync(getRoomSocket(), SAME_WAVELENGTH_PHASE_CHANGED_EVENT, sync);
    return () => {
      gate.invalidate();
      hasView.current = false;
      retired.clear();
      unbind();
    };
  }, [enabled, sync]);

  const action = useCallback(
    async (event: string, payload: unknown) => {
      if (!enabled || actionInFlight.current) return null;
      actionInFlight.current = true;
      syncGate.current.invalidate();
      setSubmitting(true);
      setError(null);
      try {
        const response = await emitPluginWithAck<ViewResponse>(event, payload);
        if (response.success) {
          hasView.current = true;
          syncGate.current.invalidate();
          applyView(response.data.view);
        } else {
          setError(response.error.message);
        }
        return response.success ? response.data.view : null;
      } finally {
        actionInFlight.current = false;
        setSubmitting(false);
      }
    },
    [applyView, enabled],
  );

  const submitIndividualGuess = useCallback(
    async (position: number) => {
      if (!enabled || actionInFlight.current || !view || view.mode !== 'individual') return null;
      actionInFlight.current = true;
      syncGate.current.invalidate();
      setSubmitting(true);
      setError(null);
      try {
        let latestView = view;
        if (view.ownProposal !== position) {
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
            return null;
          }
          latestView = proposalResponse.data.view;
          hasView.current = true;
          syncGate.current.invalidate();
          applyView(latestView);
        }

        const confirmResponse = await emitPluginWithAck<ViewResponse>(
          SAME_WAVELENGTH_CONFIRM_EVENT,
          {
            turnId: latestView.turnId,
            requestId: requestId(),
          },
        );
        if (confirmResponse.success) {
          hasView.current = true;
          syncGate.current.invalidate();
          applyView(confirmResponse.data.view);
        } else {
          setError(confirmResponse.error.message);
        }
        return confirmResponse.success ? confirmResponse.data.view : null;
      } finally {
        actionInFlight.current = false;
        setSubmitting(false);
      }
    },
    [applyView, enabled, view],
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
