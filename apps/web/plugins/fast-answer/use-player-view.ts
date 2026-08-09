'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FastAnswerPlayerView } from '@wanasatna/shared';
import {
  FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
  FAST_ANSWER_PHASE_CHANGED_EVENT,
  FAST_ANSWER_SET_CATEGORY_EVENT,
  FAST_ANSWER_SUBMIT_ANSWER_EVENT,
  FAST_ANSWER_SYNC_EVENT,
} from '@wanasatna/shared';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

async function fetchPlayerView(): Promise<{
  view: FastAnswerPlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<{ view: FastAnswerPlayerView }>(
    FAST_ANSWER_SYNC_EVENT,
  );

  if (!response.success) {
    return { view: null, errorMessage: response.error.message };
  }

  return { view: response.data.view, errorMessage: null };
}

export function useFastAnswerPlayerView(enabled: boolean) {
  const [view, setView] = useState<FastAnswerPlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [incorrectFeedback, setIncorrectFeedback] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const hasViewRef = useRef(false);

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
      setView(null);
      setErrorMessage(null);
      setIsLoading(false);
      setActionError(null);
      setIncorrectFeedback(null);
      setIsSubmittingAction(false);
      setRemainingSeconds(0);
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

    socket.on(FAST_ANSWER_PHASE_CHANGED_EVENT, onPhaseChanged);

    return () => {
      socket.off(FAST_ANSWER_PHASE_CHANGED_EVENT, onPhaseChanged);
    };
  }, [enabled, syncView]);

  useEffect(() => {
    if (!enabled || !view || view.gamePhase !== 'question' || !view.questionDeadlineAtMs) {
      return;
    }

    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((view.questionDeadlineAtMs! - Date.now()) / 1000));
      setRemainingSeconds(seconds);
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, view?.gamePhase, view?.questionDeadlineAtMs]);

  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!enabled || isSubmittingAction) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);
      setIncorrectFeedback(null);

      const response = await emitPluginWithAck<{
        correct: boolean;
        view: FastAnswerPlayerView;
      }>(FAST_ANSWER_SUBMIT_ANSWER_EVENT, { answer });

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      setView(response.data.view);
      setRemainingSeconds(response.data.view.phaseRemainingSeconds);

      if (!response.data.correct) {
        setIncorrectFeedback('إجابة غير صحيحة');
      }

      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction],
  );

  const continueFromRoundResults = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: FastAnswerPlayerView }>(
      FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    setView(response.data.view);
    setRemainingSeconds(response.data.view.phaseRemainingSeconds);
    setIncorrectFeedback(null);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

  const setNextRoundCategory = useCallback(
    async (categoryId: string | null) => {
      if (!enabled || isSubmittingAction) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{ view: FastAnswerPlayerView }>(
        FAST_ANSWER_SET_CATEGORY_EVENT,
        { categoryId },
      );

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      setView(response.data.view);
      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction],
  );

  return {
    view,
    errorMessage,
    isLoading,
    actionError,
    incorrectFeedback,
    isSubmittingAction,
    remainingSeconds,
    setNextRoundCategory,
    submitAnswer,
    continueFromRoundResults,
  };
}
