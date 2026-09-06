'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BaraAlSalafaPlayerView } from '@wanasatna/shared';
import {
  BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT,
  BARA_AL_SALAFA_ADVANCE_FREE_QUESTION_EVENT,
  BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
  BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT,
  BARA_AL_SALAFA_PHASE_CHANGED_EVENT,
  BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT,
  BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT,
  BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  BARA_AL_SALAFA_SUBMIT_VOTE_EVENT,
  BARA_AL_SALAFA_SYNC_EVENT,
} from '@wanasatna/shared';
import { AckGenerationGate, runLatestAck } from '@/lib/game-plugins/ack-generation';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';
import { isStaleBaraRoleView } from './stale-round-view';

async function fetchPlayerView(): Promise<{
  view: BaraAlSalafaPlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<{ view: BaraAlSalafaPlayerView }>(
    BARA_AL_SALAFA_SYNC_EVENT,
  );

  if (!response.success) {
    return { view: null, errorMessage: response.error.message };
  }

  return { view: response.data.view, errorMessage: null };
}

export function useBaraAlSalafaPlayerView(enabled: boolean) {
  const [view, setView] = useState<BaraAlSalafaPlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const hasViewRef = useRef(false);
  const viewRef = useRef<BaraAlSalafaPlayerView | null>(null);
  const awaitingRoundFromRef = useRef<number | null>(null);
  const syncGateRef = useRef(new AckGenerationGate());

  const commitView = useCallback((next: BaraAlSalafaPlayerView) => {
    viewRef.current = next;
    hasViewRef.current = true;
    if (!isStaleBaraRoleView(awaitingRoundFromRef.current, next)) {
      awaitingRoundFromRef.current = null;
      setIsLoading(false);
    }
    setView(next);
    setErrorMessage(null);
  }, []);

  // Background re-syncs must not blank a live phase on a transient failure.
  // Exception: after round-results ends, keep a recovery/loading state until the
  // new round's authoritative view arrives so the previous secret role is not shown.
  const syncView = useCallback(async () => {
    const isInitialLoad = !hasViewRef.current;
    const awaitingFromRound = awaitingRoundFromRef.current;

    if (isInitialLoad || awaitingFromRound !== null) {
      setIsLoading(true);
      if (isInitialLoad) {
        setErrorMessage(null);
      }
    }

    const result = await runLatestAck(syncGateRef.current, fetchPlayerView);

    if (result === undefined) {
      return;
    }

    if (result.view) {
      if (isStaleBaraRoleView(awaitingRoundFromRef.current, result.view)) {
        setIsLoading(true);
        return;
      }
      commitView(result.view);
      return;
    }

    if (isInitialLoad) {
      setErrorMessage(result.errorMessage);
      setIsLoading(false);
      return;
    }

    if (awaitingRoundFromRef.current !== null) {
      setIsLoading(true);
    }
  }, [commitView]);

  useEffect(() => {
    if (!enabled) {
      syncGateRef.current.invalidate();
      hasViewRef.current = false;
      viewRef.current = null;
      awaitingRoundFromRef.current = null;
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
    return bindPluginViewResync(socket, BARA_AL_SALAFA_PHASE_CHANGED_EVENT, syncView, {
      onPhaseChanged: () => {
        const currentView = viewRef.current;
        if (currentView?.gamePhase === 'round-results') {
          awaitingRoundFromRef.current = currentView.currentRound;
          setIsLoading(true);
        }
      },
    });
  }, [enabled, syncView]);


  const submitRoleUnderstood = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: BaraAlSalafaPlayerView }>(
      BARA_AL_SALAFA_SUBMIT_ROLE_UNDERSTOOD_EVENT,
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    commitView(response.data.view);
    setIsSubmittingAction(false);
  }, [commitView, enabled, isSubmittingAction]);

  const advanceDirectedQuestion = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: BaraAlSalafaPlayerView }>(
      BARA_AL_SALAFA_ADVANCE_DIRECTED_QUESTION_EVENT,
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    commitView(response.data.view);
    setIsSubmittingAction(false);
  }, [commitView, enabled, isSubmittingAction]);

  const continueFromRoundResults = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: BaraAlSalafaPlayerView }>(
      BARA_AL_SALAFA_CONTINUE_ROUND_RESULTS_EVENT,
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    commitView(response.data.view);
    setIsSubmittingAction(false);
  }, [commitView, enabled, isSubmittingAction]);

  const chooseFreeQuestionPlayer = useCallback(
    async (targetPlayerId: string) => {
      if (!enabled || isSubmittingAction) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{ view: BaraAlSalafaPlayerView }>(
        BARA_AL_SALAFA_CHOOSE_FREE_QUESTION_PLAYER_EVENT,
        { targetPlayerId },
      );

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      commitView(response.data.view);
      setIsSubmittingAction(false);
    },
    [commitView, enabled, isSubmittingAction],
  );

  const skipFreeQuestionTurn = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: BaraAlSalafaPlayerView }>(
      BARA_AL_SALAFA_SKIP_FREE_QUESTION_TURN_EVENT,
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    commitView(response.data.view);
    setIsSubmittingAction(false);
  }, [commitView, enabled, isSubmittingAction]);

  const advanceFreeQuestion = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: BaraAlSalafaPlayerView }>(
      BARA_AL_SALAFA_ADVANCE_FREE_QUESTION_EVENT,
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    commitView(response.data.view);
    setIsSubmittingAction(false);
  }, [commitView, enabled, isSubmittingAction]);

  const submitVote = useCallback(
    async (targetPlayerId: string) => {
      if (!enabled || isSubmittingAction) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{ view: BaraAlSalafaPlayerView }>(
        BARA_AL_SALAFA_SUBMIT_VOTE_EVENT,
        { targetPlayerId },
      );

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      commitView(response.data.view);
      setIsSubmittingAction(false);
    },
    [commitView, enabled, isSubmittingAction],
  );

  const submitImpostorGuess = useCallback(
    async (selectedWord: string) => {
      if (!enabled || isSubmittingAction) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{ view: BaraAlSalafaPlayerView }>(
        BARA_AL_SALAFA_SUBMIT_IMPOSTOR_GUESS_EVENT,
        { selectedWord },
      );

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      commitView(response.data.view);
      setIsSubmittingAction(false);
    },
    [commitView, enabled, isSubmittingAction],
  );

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_WANASATNA_TEST_MODE !== '1') {
      return;
    }

    const testActions = {
      getView: () => view,
      skipFreeQuestionTurn,
      advanceFreeQuestion,
      submitVote,
      submitImpostorGuess,
      submitRoleUnderstood,
      advanceDirectedQuestion,
      continueFromRoundResults,
    };

    (window as Window & { __wanasatnaTest?: typeof testActions }).__wanasatnaTest = testActions;

    return () => {
      delete (window as Window & { __wanasatnaTest?: typeof testActions }).__wanasatnaTest;
    };
  }, [
    advanceDirectedQuestion,
    advanceFreeQuestion,
    continueFromRoundResults,
    skipFreeQuestionTurn,
    submitImpostorGuess,
    submitRoleUnderstood,
    submitVote,
    view,
  ]);

  return {
    view,
    errorMessage,
    isLoading,
    actionError,
    isSubmittingAction,
    submitRoleUnderstood,
    advanceDirectedQuestion,
    continueFromRoundResults,
    chooseFreeQuestionPlayer,
    skipFreeQuestionTurn,
    advanceFreeQuestion,
    submitVote,
    submitImpostorGuess,
  };
}
