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

const LOCALLY_TIMED_PHASES = new Set([
  'ready',
  'guessing',
  'stop-timer',
  'round-results',
  'match-completed',
]);

export function useTimingChallengePlayerView(enabled: boolean) {
  const [view, setView] = useState<TimingChallengePlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const hasViewRef = useRef(false);
  const actionLockRef = useRef(false);
  const roundIdRef = useRef<string | null>(null);

  const syncView = useCallback(async () => {
    const isInitialLoad = !hasViewRef.current;

    if (isInitialLoad) {
      setIsLoading(true);
      setErrorMessage(null);
    }

    const result = await fetchPlayerView();

    if (result.view) {
      hasViewRef.current = true;
      roundIdRef.current = result.view.roundId;
      setView(result.view);
      setRemainingSeconds(result.view.phaseRemainingSeconds);
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
      roundIdRef.current = null;
      setView(null);
      setErrorMessage(null);
      setIsLoading(false);
      setRemainingSeconds(0);
      setActionError(null);
      setIsSubmittingAction(false);
      actionLockRef.current = false;
      return;
    }

    void syncView();
  }, [enabled, syncView]);

  useEffect(() => {
    roundIdRef.current = view?.roundId ?? null;
  }, [view?.roundId]);

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

  useEffect(() => {
    if (!enabled || !view || !LOCALLY_TIMED_PHASES.has(view.gamePhase)) {
      return;
    }

    setRemainingSeconds(view.phaseRemainingSeconds);

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, view?.gamePhase, view?.phaseRemainingSeconds]);

  const runAction = useCallback(
    async (event: string, payload?: Record<string, unknown>) => {
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

      if (response.data.view) {
        roundIdRef.current = response.data.view.roundId;
        setView(response.data.view);
        setRemainingSeconds(response.data.view.phaseRemainingSeconds);
      }

      actionLockRef.current = false;
      setIsSubmittingAction(false);
    },
    [enabled],
  );

  const markReady = useCallback(async () => {
    if (!roundIdRef.current) {
      return;
    }
    await runAction(TIMING_CHALLENGE_READY_EVENT, { roundId: roundIdRef.current });
  }, [runAction]);

  const submitGuess = useCallback(
    async (guessSeconds: number) => {
      if (!roundIdRef.current) {
        return;
      }
      await runAction(TIMING_CHALLENGE_SUBMIT_GUESS_EVENT, {
        roundId: roundIdRef.current,
        guessSeconds,
      });
    },
    [runAction],
  );

  const startTimer = useCallback(async () => {
    if (!roundIdRef.current) {
      return;
    }
    await runAction(TIMING_CHALLENGE_START_TIMER_EVENT, { roundId: roundIdRef.current });
  }, [runAction]);

  const stopTimer = useCallback(async () => {
    if (!roundIdRef.current) {
      return;
    }
    await runAction(TIMING_CHALLENGE_STOP_TIMER_EVENT, { roundId: roundIdRef.current });
  }, [runAction]);

  const continueFromRoundResults = useCallback(async () => {
    await runAction(TIMING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT);
  }, [runAction]);

  return {
    view,
    errorMessage,
    isLoading,
    remainingSeconds,
    actionError,
    isSubmittingAction,
    markReady,
    submitGuess,
    startTimer,
    stopTimer,
    continueFromRoundResults,
  };
}
