'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type {
  DrawGuessCanvasUpdatedPayload,
  DrawGuessPlayerView,
  DrawGuessStrokePayload,
  DrawGuessStrokePointsPayload,
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
  DRAW_GUESS_UNDO_EVENT,
} from '@wanasatna/shared';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';
import type { DrawingCanvasHandle } from './drawing-canvas';

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

export function useDrawGuessPlayerView(
  enabled: boolean,
  canvasRef?: RefObject<DrawingCanvasHandle | null>,
) {
  const [view, setView] = useState<DrawGuessPlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const hasViewRef = useRef(false);
  const turnIdRef = useRef<string | null>(null);

  const syncView = useCallback(async () => {
    const isInitialLoad = !hasViewRef.current;

    if (isInitialLoad) {
      setIsLoading(true);
      setErrorMessage(null);
    }

    const result = await fetchPlayerView();

    if (result.view) {
      hasViewRef.current = true;
      turnIdRef.current = result.view.turnId;
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
      turnIdRef.current = null;
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
    turnIdRef.current = view?.turnId ?? null;
  }, [view?.turnId]);

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

      setView((current) => {
        if (!current) {
          return current;
        }

        if (payload.turnId && payload.turnId !== current.turnId) {
          return current;
        }

        return {
          ...current,
          strokes: payload.strokes,
        };
      });
    };

    const onStrokePoints = (payload: DrawGuessStrokePointsPayload) => {
      if (!payload || typeof payload.strokeId !== 'string' || !Array.isArray(payload.points)) {
        return;
      }

      if (payload.turnId && payload.turnId !== turnIdRef.current) {
        return;
      }

      canvasRef?.current?.appendRemotePoints(payload.strokeId, payload.points);
    };

    socket.on(DRAW_GUESS_PHASE_CHANGED_EVENT, onPhaseChanged);
    socket.on(DRAW_GUESS_CANVAS_UPDATED_EVENT, onCanvasUpdated);
    socket.on(DRAW_GUESS_STROKE_POINTS_EVENT, onStrokePoints);

    return () => {
      socket.off(DRAW_GUESS_PHASE_CHANGED_EVENT, onPhaseChanged);
      socket.off(DRAW_GUESS_CANVAS_UPDATED_EVENT, onCanvasUpdated);
      socket.off(DRAW_GUESS_STROKE_POINTS_EVENT, onStrokePoints);
    };
  }, [canvasRef, enabled, syncView]);

  const submitGuess = useCallback(
    async (guess: string) => {
      if (!enabled || isSubmittingAction) {
        return;
      }

      setIsSubmittingAction(true);
      setActionError(null);
      setGuessFeedback(null);

      const response = await emitPluginWithAck<{
        correct: boolean;
        feedback?: string;
        view: DrawGuessPlayerView;
      }>(DRAW_GUESS_SUBMIT_GUESS_EVENT, { guess });

      if (!response.success) {
        setActionError(response.error.message);
        setIsSubmittingAction(false);
        return;
      }

      setView(response.data.view);
      turnIdRef.current = response.data.view.turnId;

      if (!response.data.correct) {
        setGuessFeedback(response.data.feedback ?? 'إجابة خاطئة');
      } else {
        setGuessFeedback(null);
      }

      setIsSubmittingAction(false);
    },
    [enabled, isSubmittingAction],
  );

  const clearCanvas = useCallback(async () => {
    if (!enabled || isSubmittingAction || !turnIdRef.current) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: DrawGuessPlayerView }>(
      DRAW_GUESS_CLEAR_CANVAS_EVENT,
      { turnId: turnIdRef.current },
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    setView(response.data.view);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

  const undoStroke = useCallback(async () => {
    if (!enabled || isSubmittingAction || !turnIdRef.current) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: DrawGuessPlayerView }>(DRAW_GUESS_UNDO_EVENT, {
      turnId: turnIdRef.current,
    });

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
    turnIdRef.current = response.data.view.turnId;
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

  const strokeReadyPromisesRef = useRef(new Map<string, Promise<void>>());

  const emitStroke = useCallback(
    async (payload: Omit<DrawGuessStrokePayload, 'turnId'>) => {
      if (!enabled || !turnIdRef.current) {
        return;
      }

      const fullPayload: DrawGuessStrokePayload = {
        ...payload,
        turnId: turnIdRef.current,
      };

      const strokePromise = emitPluginWithAck<{ ok: true }>(
        DRAW_GUESS_STROKE_EVENT,
        fullPayload,
      ).then(() => undefined);

      strokeReadyPromisesRef.current.set(payload.strokeId, strokePromise);
      await strokePromise;
    },
    [enabled],
  );

  const emitStrokePoints = useCallback(
    async (payload: Omit<DrawGuessStrokePointsPayload, 'turnId'>) => {
      if (!enabled || !turnIdRef.current) {
        return;
      }

      const ready = strokeReadyPromisesRef.current.get(payload.strokeId);

      if (ready) {
        await ready;
      }

      getRoomSocket().emit(DRAW_GUESS_STROKE_POINTS_EVENT, {
        ...payload,
        turnId: turnIdRef.current,
      });
    },
    [enabled],
  );

  const emitStrokeEnd = useCallback(
    (payload: { strokeId: string }) => {
      if (!enabled || !turnIdRef.current) {
        return;
      }

      void emitPluginWithAck<{ ok: true }>(DRAW_GUESS_STROKE_EVENT, {
        turnId: turnIdRef.current,
        strokeId: payload.strokeId,
      });
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
    submitGuess,
    clearCanvas,
    undoStroke,
    continueFromRoundResults,
    emitStroke,
    emitStrokePoints,
    emitStrokeEnd,
  };
}
