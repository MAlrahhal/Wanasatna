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
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

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
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const hasViewRef = useRef(false);

  // Background re-syncs (per-second server ticks, phase changes) must never
  // flip the screen back to a loading/error state: loading and errors only
  // surface before the first view exists, and a transient failed re-sync
  // keeps the last good view instead of blanking the phase screen.
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
      setRemainingSeconds(result.view.phaseRemainingSeconds);
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
      setRemainingSeconds(0);
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

    socket.on(BARA_AL_SALAFA_PHASE_CHANGED_EVENT, onPhaseChanged);

    return () => {
      socket.off(BARA_AL_SALAFA_PHASE_CHANGED_EVENT, onPhaseChanged);
    };
  }, [enabled, syncView]);

  useEffect(() => {
    const locallyTimedPhases = new Set(['description', 'reveal-impostor', 'match-completed']);

    if (!enabled || !view || !locallyTimedPhases.has(view.gamePhase)) {
      return;
    }

    setRemainingSeconds(view.phaseRemainingSeconds);

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, view?.gamePhase, view?.phaseRemainingSeconds, view?.currentSpeakerName, view?.submittedVotesCount]);

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

    setView(response.data.view);
    setRemainingSeconds(response.data.view.phaseRemainingSeconds);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

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

    setView(response.data.view);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

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

    setView(response.data.view);
    setRemainingSeconds(response.data.view.phaseRemainingSeconds);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

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

      setView(response.data.view);
      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction],
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

    setView(response.data.view);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

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

    setView(response.data.view);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

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

      setView(response.data.view);
      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction],
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

      setView(response.data.view);
      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction],
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
    remainingSeconds,
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
