'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FastAnswerPlayerView } from '@wanasatna/shared';
import {
  FAST_ANSWER_CONTINUE_ROUND_RESULTS_EVENT,
  FAST_ANSWER_PHASE_CHANGED_EVENT,
  FAST_ANSWER_SUBMIT_ANSWER_EVENT,
  FAST_ANSWER_SYNC_EVENT,
} from '@wanasatna/shared';
import { AckGenerationGate, runLatestAck } from '@/lib/game-plugins/ack-generation';
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

export function resolveFastAnswerDeadlineAtMs(
  view: Pick<FastAnswerPlayerView, 'deadlineAtMs' | 'questionDeadlineAtMs'> | null | undefined,
): number | null {
  if (!view) {
    return null;
  }
  return view.deadlineAtMs ?? view.questionDeadlineAtMs ?? null;
}

export function useFastAnswerPlayerView(enabled: boolean) {
  const [view, setView] = useState<FastAnswerPlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [incorrectFeedback, setIncorrectFeedback] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const hasViewRef = useRef(false);
  const roundIdRef = useRef<string | null>(null);
  const syncGateRef = useRef(new AckGenerationGate());

  const syncView = useCallback(async () => {
    const isInitialLoad = !hasViewRef.current;

    if (isInitialLoad) {
      setIsLoading(true);
      setErrorMessage(null);
    }

    const result = await runLatestAck(syncGateRef.current, fetchPlayerView);

    if (result === undefined) {
      return;
    }

    if (result.view) {
      hasViewRef.current = true;
      roundIdRef.current = result.view.roundId;
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
      syncGateRef.current.invalidate();
      hasViewRef.current = false;
      roundIdRef.current = null;
      setView(null);
      setErrorMessage(null);
      setIsLoading(false);
      setActionError(null);
      setIncorrectFeedback(null);
      setIsSubmittingAction(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = getRoomSocket();

    const onPhaseChanged = () => {
      void syncView();
    };

    socket.on(FAST_ANSWER_PHASE_CHANGED_EVENT, onPhaseChanged);
    void syncView();

    return () => {
      socket.off(FAST_ANSWER_PHASE_CHANGED_EVENT, onPhaseChanged);
    };
  }, [enabled, syncView]);

  useEffect(() => {
    roundIdRef.current = view?.roundId ?? null;
  }, [view?.roundId]);


  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!enabled || isSubmittingAction || !roundIdRef.current) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);
      setIncorrectFeedback(null);

      const response = await emitPluginWithAck<{
        correct: boolean;
        view: FastAnswerPlayerView;
      }>(FAST_ANSWER_SUBMIT_ANSWER_EVENT, {
        answer,
        roundId: roundIdRef.current,
      });

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      setView(response.data.view);
      roundIdRef.current = response.data.view.roundId;

      if (!response.data.correct) {
        setIncorrectFeedback('إجابة غير صحيحة');
      } else {
        setIncorrectFeedback(null);
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
    roundIdRef.current = response.data.view.roundId;
    setIncorrectFeedback(null);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

  return {
    view,
    errorMessage,
    isLoading,
    actionError,
    incorrectFeedback,
    isSubmittingAction,
    submitAnswer,
    continueFromRoundResults,
  };
}
