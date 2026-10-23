'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EmojiLanguageGuessFeedback, EmojiLanguagePlayerView } from '@wanasatna/shared';
import {
  EMOJI_LANGUAGE_PHASE_CHANGED_EVENT,
  EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT,
  EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT,
  EMOJI_LANGUAGE_SYNC_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = {
  view: EmojiLanguagePlayerView;
  feedback?: EmojiLanguageGuessFeedback;
};

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function useEmojiLanguagePlayerView(enabled: boolean) {
  const [view, setView] = useState<EmojiLanguagePlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<EmojiLanguageGuessFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasView = useRef(false);
  const roundId = useRef<string | null>(null);

  const acceptView = useCallback((nextView: EmojiLanguagePlayerView) => {
    if (roundId.current !== nextView.roundId) {
      roundId.current = nextView.roundId;
      setFeedback(null);
    }
    setView(nextView);
  }, []);

  const sync = useCallback(async () => {
    if (!enabled) return;
    if (!hasView.current) setLoading(true);
    const response = await emitPluginWithAck<ViewResponse>(EMOJI_LANGUAGE_SYNC_EVENT);
    if (response.success) {
      hasView.current = true;
      acceptView(response.data.view);
      setError(null);
    } else if (!hasView.current) {
      setError(response.error.message);
    }
    setLoading(false);
  }, [acceptView, enabled]);

  useEffect(() => {
    if (!enabled) {
      hasView.current = false;
      return;
    }
    return bindPluginViewResync(getRoomSocket(), EMOJI_LANGUAGE_PHASE_CHANGED_EVENT, sync);
  }, [enabled, sync]);

  const action = useCallback(
    async (event: string, payload: unknown) => {
      if (!enabled || submitting) return null;
      setSubmitting(true);
      setError(null);
      const response = await emitPluginWithAck<ViewResponse>(event, payload);
      if (response.success) {
        acceptView(response.data.view);
        setFeedback(response.data.feedback ?? null);
        hasView.current = true;
      } else {
        setError(response.error.message);
      }
      setSubmitting(false);
      return response.success ? response.data : null;
    },
    [acceptView, enabled, submitting],
  );

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return {
    view,
    error,
    feedback,
    loading,
    submitting,
    clearFeedback,
    submitClue: (emojis: string[]) =>
      view
        ? action(EMOJI_LANGUAGE_SUBMIT_CLUE_EVENT, { roundId: view.roundId, emojis })
        : Promise.resolve(null),
    submitGuess: (answer: string) =>
      view
        ? action(EMOJI_LANGUAGE_SUBMIT_GUESS_EVENT, {
            roundId: view.roundId,
            answer,
            requestId: requestId(),
          })
        : Promise.resolve(null),
  };
}
