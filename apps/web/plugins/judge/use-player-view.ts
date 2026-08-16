'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JudgePlayerView } from '@wanasatna/shared';
import {
  JUDGE_CONTINUE_ROUND_RESULTS_EVENT,
  JUDGE_PHASE_CHANGED_EVENT,
  JUDGE_SELECT_WINNER_EVENT,
  JUDGE_SUBMIT_ANSWER_EVENT,
  JUDGE_SYNC_EVENT,
} from '@wanasatna/shared';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

async function fetchPlayerView(): Promise<{
  view: JudgePlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<{ view: JudgePlayerView }>(JUDGE_SYNC_EVENT);

  if (!response.success) {
    return { view: null, errorMessage: response.error.message };
  }

  return { view: response.data.view, errorMessage: null };
}

export function useJudgePlayerView(enabled: boolean) {
  const [view, setView] = useState<JudgePlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
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

    socket.on(JUDGE_PHASE_CHANGED_EVENT, onPhaseChanged);
    return () => {
      socket.off(JUDGE_PHASE_CHANGED_EVENT, onPhaseChanged);
    };
  }, [enabled, syncView]);


  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!enabled || isSubmittingAction || !view?.roundId) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{ view: JudgePlayerView }>(
        JUDGE_SUBMIT_ANSWER_EVENT,
        { answer, roundId: view.roundId },
      );

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      setView(response.data.view);
      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction, view?.roundId],
  );

  const selectWinner = useCallback(
    async (answerId: string) => {
      if (!enabled || isSubmittingAction || !view?.roundId) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{ view: JudgePlayerView }>(
        JUDGE_SELECT_WINNER_EVENT,
        { answerId, roundId: view.roundId },
      );

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      setView(response.data.view);
      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction, view?.roundId],
  );

  const continueFromRoundResults = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: JudgePlayerView }>(
      JUDGE_CONTINUE_ROUND_RESULTS_EVENT,
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    if (response.data?.view) {
      setView(response.data.view);
    }
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

  return {
    view,
    errorMessage,
    isLoading,
    actionError,
    isSubmittingAction,
    submitAnswer,
    selectWinner,
    continueFromRoundResults,
  };
}
