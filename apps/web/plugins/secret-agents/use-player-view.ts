'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SecretAgentsPlayerView, SecretAgentsRole, SecretAgentsTeam } from '@wanasatna/shared';
import {
  SECRET_AGENTS_ASSIGN_EVENT,
  SECRET_AGENTS_CONFIRM_CARD_EVENT,
  SECRET_AGENTS_PASS_EVENT,
  SECRET_AGENTS_PHASE_CHANGED_EVENT,
  SECRET_AGENTS_SUBMIT_CLUE_EVENT,
  SECRET_AGENTS_SYNC_EVENT,
  SECRET_AGENTS_TOGGLE_NOMINATION_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: SecretAgentsPlayerView };

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function useSecretAgentsPlayerView(enabled: boolean) {
  const [view, setView] = useState<SecretAgentsPlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasView = useRef(false);

  const sync = useCallback(async () => {
    if (!enabled) return;
    if (!hasView.current) setLoading(true);
    const response = await emitPluginWithAck<ViewResponse>(SECRET_AGENTS_SYNC_EVENT);
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
    return bindPluginViewResync(getRoomSocket(), SECRET_AGENTS_PHASE_CHANGED_EVENT, sync);
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
    assign: (team: SecretAgentsTeam, role: SecretAgentsRole) =>
      action(SECRET_AGENTS_ASSIGN_EVENT, { team, role }),
    submitClue: (word: string, value: number | 'unlimited') =>
      view
        ? action(SECRET_AGENTS_SUBMIT_CLUE_EVENT, { turnId: view.turnId, word, value })
        : Promise.resolve(false),
    toggleNomination: (cardId: string) =>
      view
        ? action(SECRET_AGENTS_TOGGLE_NOMINATION_EVENT, {
            turnId: view.turnId,
            cardId,
            requestId: requestId(),
          })
        : Promise.resolve(false),
    confirmCard: (cardId: string) =>
      view
        ? action(SECRET_AGENTS_CONFIRM_CARD_EVENT, {
            turnId: view.turnId,
            cardId,
            requestId: requestId(),
          })
        : Promise.resolve(false),
    pass: () =>
      view
        ? action(SECRET_AGENTS_PASS_EVENT, {
            turnId: view.turnId,
            requestId: requestId(),
          })
        : Promise.resolve(false),
  };
}
