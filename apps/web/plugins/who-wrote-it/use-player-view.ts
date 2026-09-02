'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WhoWroteItPlayerView } from '@wanasatna/shared';
import {
  WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
  WHO_WROTE_IT_PHASE_CHANGED_EVENT,
  WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
  WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
  WHO_WROTE_IT_SYNC_EVENT,
} from '@wanasatna/shared';
import { AckGenerationGate, runLatestAck } from '@/lib/game-plugins/ack-generation';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

async function fetchPlayerView(): Promise<{
  view: WhoWroteItPlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<{ view: WhoWroteItPlayerView }>(
    WHO_WROTE_IT_SYNC_EVENT,
  );

  if (!response.success) {
    return { view: null, errorMessage: response.error.message };
  }

  return { view: response.data.view, errorMessage: null };
}

export function useWhoWroteItPlayerView(enabled: boolean) {
  const [view, setView] = useState<WhoWroteItPlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const hasViewRef = useRef(false);
  const roundIdRef = useRef<string | null>(null);
  const syncGateRef = useRef(new AckGenerationGate());

  const applyView = useCallback((nextView: WhoWroteItPlayerView) => {
    hasViewRef.current = true;
    roundIdRef.current = nextView.roundId;
    setView(nextView);
    setErrorMessage(null);
  }, []);

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
      applyView(result.view);
    } else if (isInitialLoad) {
      setErrorMessage(result.errorMessage);
    }

    if (isInitialLoad) {
      setIsLoading(false);
    }
  }, [applyView]);

  useEffect(() => {
    if (!enabled) {
      syncGateRef.current.invalidate();
      hasViewRef.current = false;
      roundIdRef.current = null;
      setView(null);
      setErrorMessage(null);
      setIsLoading(false);
      setActionError(null);
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

    socket.on(WHO_WROTE_IT_PHASE_CHANGED_EVENT, onPhaseChanged);
    void syncView();

    return () => {
      socket.off(WHO_WROTE_IT_PHASE_CHANGED_EVENT, onPhaseChanged);
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

      const response = await emitPluginWithAck<{ view: WhoWroteItPlayerView }>(
        WHO_WROTE_IT_SUBMIT_ANSWER_EVENT,
        { answer, roundId: roundIdRef.current },
      );

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      applyView(response.data.view);
      setIsSubmittingAction(false);
    },
    [applyView, enabled, isSubmittingAction],
  );

  const submitOwnerGuess = useCallback(
    async (answerId: string, ownerPlayerId: string) => {
      if (!enabled || isSubmittingAction || !roundIdRef.current) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{ view: WhoWroteItPlayerView }>(
        WHO_WROTE_IT_SUBMIT_OWNER_GUESS_EVENT,
        { answerId, ownerPlayerId, roundId: roundIdRef.current },
      );

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      applyView(response.data.view);
      setIsSubmittingAction(false);
    },
    [applyView, enabled, isSubmittingAction],
  );

  const continueFromRoundResults = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view?: WhoWroteItPlayerView }>(
      WHO_WROTE_IT_CONTINUE_ROUND_RESULTS_EVENT,
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    if (response.data?.view) {
      applyView(response.data.view);
    }

    setIsSubmittingAction(false);
  }, [applyView, enabled, isSubmittingAction]);

  return {
    view,
    errorMessage,
    isLoading,
    actionError,
    isSubmittingAction,
    submitAnswer,
    submitOwnerGuess,
    continueFromRoundResults,
  };
}
