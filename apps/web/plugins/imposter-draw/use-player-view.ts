'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DrawStroke,
  ImposterDrawCanvasUpdatedPayload,
  ImposterDrawPlayerView,
  ImposterDrawStrokePayload,
  ImposterDrawStrokePointsPayload,
} from '@wanasatna/shared';
import {
  IMPOSTER_DRAW_CANVAS_UPDATED_EVENT,
  IMPOSTER_DRAW_CLEAR_CANVAS_EVENT,
  IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT,
  IMPOSTER_DRAW_PHASE_CHANGED_EVENT,
  IMPOSTER_DRAW_STROKE_EVENT,
  IMPOSTER_DRAW_STROKE_POINTS_EVENT,
  IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT,
  IMPOSTER_DRAW_SUBMIT_VOTE_EVENT,
  IMPOSTER_DRAW_SYNC_EVENT,
} from '@wanasatna/shared';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

async function fetchPlayerView(): Promise<{
  view: ImposterDrawPlayerView | null;
  errorMessage: string | null;
}> {
  const response = await emitPluginWithAck<{ view: ImposterDrawPlayerView }>(
    IMPOSTER_DRAW_SYNC_EVENT,
  );

  if (!response.success) {
    return { view: null, errorMessage: response.error.message };
  }

  return { view: response.data.view, errorMessage: null };
}

function mergeStrokePoints(
  strokes: DrawStroke[],
  payload: ImposterDrawStrokePointsPayload,
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

const LOCALLY_TIMED_PHASES = new Set(['drawing-turns', 'reveal', 'match-completed']);

export function useImposterDrawPlayerView(enabled: boolean) {
  const [view, setView] = useState<ImposterDrawPlayerView | null>(null);
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

    const onCanvasUpdated = (payload: ImposterDrawCanvasUpdatedPayload) => {
      if (!payload || !Array.isArray(payload.strokes)) {
        return;
      }

      setView((current) => (current ? { ...current, strokes: payload.strokes } : current));
    };

    const onStrokePoints = (payload: ImposterDrawStrokePointsPayload) => {
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

    socket.on(IMPOSTER_DRAW_PHASE_CHANGED_EVENT, onPhaseChanged);
    socket.on(IMPOSTER_DRAW_CANVAS_UPDATED_EVENT, onCanvasUpdated);
    socket.on(IMPOSTER_DRAW_STROKE_POINTS_EVENT, onStrokePoints);

    return () => {
      socket.off(IMPOSTER_DRAW_PHASE_CHANGED_EVENT, onPhaseChanged);
      socket.off(IMPOSTER_DRAW_CANVAS_UPDATED_EVENT, onCanvasUpdated);
      socket.off(IMPOSTER_DRAW_STROKE_POINTS_EVENT, onStrokePoints);
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

  const clearCanvas = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: ImposterDrawPlayerView }>(
      IMPOSTER_DRAW_CLEAR_CANVAS_EVENT,
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

      const response = await emitPluginWithAck<{ view: ImposterDrawPlayerView }>(
        IMPOSTER_DRAW_SUBMIT_VOTE_EVENT,
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

  const submitImageGuess = useCallback(
    async (selectedWord: string) => {
      if (!enabled || isSubmittingAction) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);

      const response = await emitPluginWithAck<{ view: ImposterDrawPlayerView }>(
        IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT,
        { selectedWord },
      );

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

  const continueFromRoundResults = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: ImposterDrawPlayerView }>(
      IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT,
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
    async (payload: ImposterDrawStrokePayload) => {
      if (!enabled) {
        return;
      }

      const strokePromise = emitPluginWithAck<{ view: ImposterDrawPlayerView }>(
        IMPOSTER_DRAW_STROKE_EVENT,
        payload,
      ).then(() => undefined);

      strokeReadyPromisesRef.current.set(payload.strokeId, strokePromise);
      await strokePromise;
    },
    [enabled],
  );

  const emitStrokePoints = useCallback(
    async (payload: ImposterDrawStrokePointsPayload) => {
      if (!enabled) {
        return;
      }

      const ready = strokeReadyPromisesRef.current.get(payload.strokeId);

      if (ready) {
        await ready;
      }

      void emitPluginWithAck<{ view: ImposterDrawPlayerView }>(
        IMPOSTER_DRAW_STROKE_POINTS_EVENT,
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
    clearCanvas,
    submitVote,
    submitImageGuess,
    continueFromRoundResults,
    emitStroke,
    emitStrokePoints,
  };
}
