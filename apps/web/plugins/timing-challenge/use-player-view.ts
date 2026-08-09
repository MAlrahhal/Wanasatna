'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimingChallengePlayerView } from '@wanasatna/shared';
import {
  TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  TIMING_CHALLENGE_PHASE_CHANGED_EVENT,
  TIMING_CHALLENGE_READY_EVENT,
  TIMING_CHALLENGE_START_TIMER_EVENT,
  TIMING_CHALLENGE_STOP_TIMER_EVENT,
  TIMING_CHALLENGE_SUBMIT_GUESS_EVENT,
  TIMING_CHALLENGE_SYNC_EVENT,
} from '@wanasatna/shared';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

async function fetchPlayerView(): Promise<{
  view: TimingChallengePlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<{ view: TimingChallengePlayerView }>(
    TIMING_CHALLENGE_SYNC_EVENT,
  );

  if (!response.success) {
    return { view: null, errorMessage: response.error.message };
  }

  return { view: response.data.view, errorMessage: null };
}

export function useTimingChallengePlayerView(enabled: boolean) {
  const [view, setView] = useState<TimingChallengePlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const hasViewRef = useRef(false);
  const actionLockRef = useRef(false);

  const syncView = useCallback(async () => {
    const isInitialLoad = !hasViewRef.current;

    if (isInitialLoad) {
      setIsLoading(true);
      setErrorMessage(null);
    }

    const result = await fetchPlayerView();

    if (result.view) {
      hasViewRef.current = true;
      setView(result.view);
      setErrorMessage(null);
    } else if (isInitialLoad) {
      setErrorMessage(result.errorMessage);
    }

    if (isInitialLoad) {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      hasViewRef.current = false;
      setView(null);
      setErrorMessage(null);
      setIsLoading(false);
      setActionError(null);
      setIsSubmittingAction(false);
      actionLockRef.current = false;
      return;
    }

    void syncView();
  }, [enabled, syncView]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = getRoomSocket();

    const onPhaseChanged = () => {
      void syncView();
    };

    socket.on(TIMING_CHALLENGE_PHASE_CHANGED_EVENT, onPhaseChanged);

    return () => {
      socket.off(TIMING_CHALLENGE_PHASE_CHANGED_EVENT, onPhaseChanged);
    };
  }, [enabled, syncView]);

  const runAction = useCallback(
    async (event: string, payload?: unknown) => {
      if (!enabled || actionLockRef.current) {
        return;
      }

      actionLockRef.current = true;
      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{ view: TimingChallengePlayerView }>(
        event,
        payload,
      );

      if (!response.success) {
        setActionError(response.error.message);
        actionLockRef.current = false;
        setIsSubmittingAction(false);
        return;
      }

      setView(response.data.view);
      actionLockRef.current = false;
      setIsSubmittingAction(false);
    },
    [enabled],
  );

  const markReady = useCallback(async () => {
    await runAction(TIMING_CHALLENGE_READY_EVENT);
  }, [runAction]);

  const submitGuess = useCallback(
    async (guessSeconds: number) => {
      await runAction(TIMING_CHALLENGE_SUBMIT_GUESS_EVENT, { guessSeconds });
    },
    [runAction],
  );

  const startTimer = useCallback(async () => {
    await runAction(TIMING_CHALLENGE_START_TIMER_EVENT);
  }, [runAction]);

  const stopTimer = useCallback(async () => {
    await runAction(TIMING_CHALLENGE_STOP_TIMER_EVENT);
  }, [runAction]);

  const continueFromRoundResults = useCallback(async () => {
    await runAction(TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT);
  }, [runAction]);

  return {
    view,
    errorMessage,
    isLoading,
    actionError,
    isSubmittingAction,
    markReady,
    submitGuess,
    startTimer,
    stopTimer,
    continueFromRoundResults,
  };
}
