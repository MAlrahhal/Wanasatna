'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GuessingChallengeLookUpdatePayload,
  GuessingChallengePlayerView,
} from '@wanasatna/shared';
import {
  GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT,
  GUESSING_CHALLENGE_END_QUESTION_EVENT,
  GUESSING_CHALLENGE_LOOK_EVENT,
  GUESSING_CHALLENGE_LOOK_UPDATE_EVENT,
  GUESSING_CHALLENGE_PHASE_CHANGED_EVENT,
  GUESSING_CHALLENGE_SET_CATEGORY_EVENT,
  GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT,
  GUESSING_CHALLENGE_SYNC_EVENT,
  GUESSING_CHALLENGE_REJECT_CARD_EVENT,
  GUESSING_CHALLENGE_USE_RED_CARD_EVENT,
  GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT,
} from '@wanasatna/shared';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type SyncResponse = {
  view: GuessingChallengePlayerView;
  guessCorrect?: boolean;
  guessFeedback?: string;
};

async function fetchPlayerView(): Promise<{
  view: GuessingChallengePlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<SyncResponse>(GUESSING_CHALLENGE_SYNC_EVENT);

  if (!response.success) {
    return { view: null, errorMessage: response.error.message };
  }

  return { view: response.data.view, errorMessage: null };
}

function patchLookInView(
  view: GuessingChallengePlayerView,
  payload: GuessingChallengeLookUpdatePayload,
): GuessingChallengePlayerView {
  const { playerId, yaw, pitch } = payload;
  let changed = false;

  const teammate =
    view.teammate?.playerId === playerId
      ? { ...view.teammate, lookYaw: yaw, lookPitch: pitch }
      : view.teammate;

  if (teammate !== view.teammate) {
    changed = true;
  }

  const opponents = view.opponents.map((opponent) => {
    if (opponent.playerId !== playerId) {
      return opponent;
    }
    changed = true;
    return { ...opponent, lookYaw: yaw, lookPitch: pitch };
  });

  if (!changed) {
    return view;
  }

  return {
    ...view,
    teammate,
    opponents,
  };
}

export function useGuessingChallengePlayerView(enabled: boolean) {
  const [view, setView] = useState<GuessingChallengePlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null);
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
      setGuessFeedback(null);
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
    const onLookUpdate = (payload: GuessingChallengeLookUpdatePayload) => {
      if (
        !payload ||
        typeof payload.playerId !== 'string' ||
        typeof payload.yaw !== 'number' ||
        typeof payload.pitch !== 'number'
      ) {
        return;
      }
      setView((prev) => (prev ? patchLookInView(prev, payload) : prev));
    };

    socket.on(GUESSING_CHALLENGE_PHASE_CHANGED_EVENT, onPhaseChanged);
    socket.on(GUESSING_CHALLENGE_LOOK_UPDATE_EVENT, onLookUpdate);
    return () => {
      socket.off(GUESSING_CHALLENGE_PHASE_CHANGED_EVENT, onPhaseChanged);
      socket.off(GUESSING_CHALLENGE_LOOK_UPDATE_EVENT, onLookUpdate);
    };
  }, [enabled, syncView]);

  const runAction = useCallback(
    async (event: string, payload?: unknown) => {
      if (!enabled || isSubmittingAction) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<SyncResponse>(event, payload);

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      setView(response.data.view);
      if (typeof response.data.guessFeedback === 'string') {
        setGuessFeedback(response.data.guessFeedback);
      } else if (response.data.guessCorrect) {
        setGuessFeedback(null);
      }
      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction],
  );

  const endQuestion = useCallback(() => {
    void runAction(GUESSING_CHALLENGE_END_QUESTION_EVENT);
  }, [runAction]);

  const submitFinalGuess = useCallback(
    (guess: string) => {
      void runAction(GUESSING_CHALLENGE_SUBMIT_FINAL_GUESS_EVENT, { guess });
    },
    [runAction],
  );

  const useYellowCard = useCallback(() => {
    void runAction(GUESSING_CHALLENGE_USE_YELLOW_CARD_EVENT);
  }, [runAction]);

  const useRedCard = useCallback(() => {
    void runAction(GUESSING_CHALLENGE_USE_RED_CARD_EVENT);
  }, [runAction]);

  const rejectCard = useCallback(() => {
    void runAction(GUESSING_CHALLENGE_REJECT_CARD_EVENT);
  }, [runAction]);

  const continueFromRoundResults = useCallback(() => {
    void runAction(GUESSING_CHALLENGE_CONTINUE_ROUND_RESULTS_EVENT);
  }, [runAction]);

  const setNextRoundCategory = useCallback(
    (categoryId: string | null) => {
      void runAction(GUESSING_CHALLENGE_SET_CATEGORY_EVENT, { categoryId });
    },
    [runAction],
  );

  const emitLook = useCallback(
    (yaw: number, pitch: number) => {
      if (!enabled) {
        return;
      }
      getRoomSocket().emit(GUESSING_CHALLENGE_LOOK_EVENT, { yaw, pitch });
    },
    [enabled],
  );

  return {
    view,
    errorMessage,
    isLoading,
    actionError,
    guessFeedback,
    isSubmittingAction,
    endQuestion,
    submitFinalGuess,
    useYellowCard,
    useRedCard,
    rejectCard,
    continueFromRoundResults,
    setNextRoundCategory,
    emitLook,
  };
}
