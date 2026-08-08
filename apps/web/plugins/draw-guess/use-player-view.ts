'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DrawGuessCanvasUpdatedPayload,
  DrawGuessPlayerView,
  DrawGuessStrokePayload,
  DrawGuessStrokePointsPayload,
  DrawStroke,
} from '@wanasatna/shared';
import {
  DRAW_GUESS_CANVAS_UPDATED_EVENT,
  DRAW_GUESS_CLEAR_CANVAS_EVENT,
  DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT,
  DRAW_GUESS_PHASE_CHANGED_EVENT,
  DRAW_GUESS_STROKE_EVENT,
  DRAW_GUESS_STROKE_POINTS_EVENT,
  DRAW_GUESS_SUBMIT_GUESS_EVENT,
  DRAW_GUESS_SYNC_EVENT,
} from '@wanasatna/shared';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

async function fetchPlayerView(): Promise<{
  view: DrawGuessPlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<{ view: DrawGuessPlayerView }>(DRAW_GUESS_SYNC_EVENT);

  if (!response.success) {
    return { view: null, errorMessage: response.error.message };
  }

  return { view: response.data.view, errorMessage: null };
}

function mergeStrokePoints(
  strokes: DrawStroke[],
  payload: DrawGuessStrokePointsPayload,
): DrawStroke[] {
  const index = strokes.findIndex((stroke) => stroke.id === payload.strokeId);

  if (index < 0) {
    return strokes;
  }

  return strokes.map((stroke, strokeIndex) =>
    strokeIndex === index
      ? { ...stroke, points: [...stroke.points, ...payload.points] }
      : stroke,
  );
}

export function useDrawGuessPlayerView(enabled: boolean) {
  const [view, setView] = useState<DrawGuessPlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
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

    const onCanvasUpdated = (payload: DrawGuessCanvasUpdatedPayload) => {
      if (!payload || !Array.isArray(payload.strokes)) {
        return;
      }

      setView((current) =>
        current
          ? {
              ...current,
              strokes: payload.strokes,
            }
          : current,
      );
    };

    const onStrokePoints = (payload: DrawGuessStrokePointsPayload) => {
      if (!payload || typeof payload.strokeId !== 'string' || !Array.isArray(payload.points)) {
        return;
      }

      setView((current) =>
        current
          ? {
              ...current,
              strokes: mergeStrokePoints(current.strokes, payload),
            }
          : current,
      );
    };

    socket.on(DRAW_GUESS_PHASE_CHANGED_EVENT, onPhaseChanged);
    socket.on(DRAW_GUESS_CANVAS_UPDATED_EVENT, onCanvasUpdated);
    socket.on(DRAW_GUESS_STROKE_POINTS_EVENT, onStrokePoints);

    return () => {
      socket.off(DRAW_GUESS_PHASE_CHANGED_EVENT, onPhaseChanged);
      socket.off(DRAW_GUESS_CANVAS_UPDATED_EVENT, onCanvasUpdated);
      socket.off(DRAW_GUESS_STROKE_POINTS_EVENT, onStrokePoints);
    };
  }, [enabled, syncView]);

  useEffect(() => {
    const locallyTimedPhases = new Set(['drawing', 'match-completed']);

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
  }, [enabled, view?.gamePhase, view?.phaseRemainingSeconds]);

  const submitGuess = useCallback(
    async (guess: string) => {
      if (!enabled || isSubmittingAction) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{
        correct: boolean;
        view: DrawGuessPlayerView;
      }>(DRAW_GUESS_SUBMIT_GUESS_EVENT, { guess });

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      setView(response.data.view);
      setRemainingSeconds(response.data.view.phaseRemainingSeconds);
      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction],
  );

  const clearCanvas = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: DrawGuessPlayerView }>(
      DRAW_GUESS_CLEAR_CANVAS_EVENT,
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

    const response = await emitPluginWithAck<{ view: DrawGuessPlayerView }>(
      DRAW_GUESS_CONTINUE_ROUND_RESULTS_EVENT,
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

  const strokeReadyPromisesRef = useRef(new Map<string, Promise<void>>());

  const emitStroke = useCallback(
    async (payload: DrawGuessStrokePayload) => {
      if (!enabled) {
        return;
      }

      // Rely on canvas-updated / stroke-points broadcasts for stroke state so
      // an early stroke ack cannot rewind points that arrived later.
      const strokePromise = emitPluginWithAck<{ view: DrawGuessPlayerView }>(
        DRAW_GUESS_STROKE_EVENT,
        payload,
      ).then(() => undefined);

      strokeReadyPromisesRef.current.set(payload.strokeId, strokePromise);
      await strokePromise;
    },
    [enabled],
  );

  const emitStrokePoints = useCallback(
    async (payload: DrawGuessStrokePointsPayload) => {
      if (!enabled) {
        return;
      }

      const ready = strokeReadyPromisesRef.current.get(payload.strokeId);

      if (ready) {
        await ready;
      }

      void emitPluginWithAck<{ view: DrawGuessPlayerView }>(
        DRAW_GUESS_STROKE_POINTS_EVENT,
        payload,
      );
    },
    [enabled],
  );

  return {
    view,
    errorMessage,
    isLoading,
    remainingSeconds,
    actionError,
    isSubmittingAction,
    submitGuess,
    clearCanvas,
    continueFromRoundResults,
    emitStroke,
    emitStrokePoints,
  };
}
