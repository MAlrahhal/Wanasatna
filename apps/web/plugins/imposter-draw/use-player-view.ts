'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type {
  ImposterDrawCanvasUpdatedPayload,
  ImposterDrawPlayerView,
  ImposterDrawStrokePayload,
  ImposterDrawStrokePointsPayload,
} from '@wanasatna/shared';
import type { DrawingCanvasHandle } from '@/plugins/draw-guess/drawing-canvas';
import {
  IMPOSTER_DRAW_CANVAS_UPDATED_EVENT,
  IMPOSTER_DRAW_CONTINUE_ROUND_RESULTS_EVENT,
  IMPOSTER_DRAW_PHASE_CHANGED_EVENT,
  IMPOSTER_DRAW_STROKE_EVENT,
  IMPOSTER_DRAW_STROKE_POINTS_EVENT,
  IMPOSTER_DRAW_SUBMIT_IMAGE_GUESS_EVENT,
  IMPOSTER_DRAW_SUBMIT_ROLE_UNDERSTOOD_EVENT,
  IMPOSTER_DRAW_SUBMIT_VOTE_EVENT,
  IMPOSTER_DRAW_SYNC_EVENT,
  IMPOSTER_DRAW_UNDO_EVENT,
} from '@wanasatna/shared';
import { AckGenerationGate, runLatestAck } from '@/lib/game-plugins/ack-generation';
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

export function useImposterDrawPlayerView(
  enabled: boolean,
  canvasRef?: RefObject<DrawingCanvasHandle | null>,
) {
  const [view, setView] = useState<ImposterDrawPlayerView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const hasViewRef = useRef(false);
  const turnIdRef = useRef<string | null>(null);
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
      syncGateRef.current.invalidate();
      hasViewRef.current = false;
      turnIdRef.current = null;
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

    const onCanvasUpdated = (payload: ImposterDrawCanvasUpdatedPayload) => {
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
          currentTurnStrokeIds: Array.isArray(payload.currentTurnStrokeIds)
            ? payload.currentTurnStrokeIds
            : current.currentTurnStrokeIds,
        };
      });
    };

    const onStrokePoints = (payload: ImposterDrawStrokePointsPayload) => {
      if (!payload || typeof payload.strokeId !== 'string' || !Array.isArray(payload.points)) {
        return;
      }

      if (payload.turnId && payload.turnId !== turnIdRef.current) {
        return;
      }

      canvasRef?.current?.appendRemotePoints(payload.strokeId, payload.points);
    };

    socket.on(IMPOSTER_DRAW_PHASE_CHANGED_EVENT, onPhaseChanged);
    socket.on(IMPOSTER_DRAW_CANVAS_UPDATED_EVENT, onCanvasUpdated);
    socket.on(IMPOSTER_DRAW_STROKE_POINTS_EVENT, onStrokePoints);
    void syncView();

    return () => {
      socket.off(IMPOSTER_DRAW_PHASE_CHANGED_EVENT, onPhaseChanged);
      socket.off(IMPOSTER_DRAW_CANVAS_UPDATED_EVENT, onCanvasUpdated);
      socket.off(IMPOSTER_DRAW_STROKE_POINTS_EVENT, onStrokePoints);
    };
  }, [canvasRef, enabled, syncView]);

  useEffect(() => {
    turnIdRef.current = view?.turnId ?? null;
  }, [view?.turnId]);


  const submitRoleUnderstood = useCallback(async () => {
    if (!enabled || isSubmittingAction) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: ImposterDrawPlayerView }>(
      IMPOSTER_DRAW_SUBMIT_ROLE_UNDERSTOOD_EVENT,
    );

    if (!response.success) {
      setActionError(response.error.message);
      setIsSubmittingAction(false);
      return;
    }

    turnIdRef.current = response.data.view.turnId;
    setView(response.data.view);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

  const undoStroke = useCallback(async () => {
    if (!enabled || isSubmittingAction || !turnIdRef.current) {
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const response = await emitPluginWithAck<{ view: ImposterDrawPlayerView }>(
      IMPOSTER_DRAW_UNDO_EVENT,
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

    turnIdRef.current = response.data.view.turnId;
    setView(response.data.view);
    setIsSubmittingAction(false);
  }, [enabled, isSubmittingAction]);

  const strokeReadyPromisesRef = useRef(new Map<string, Promise<void>>());

  const emitStroke = useCallback(
    async (payload: Omit<ImposterDrawStrokePayload, 'turnId'>) => {
      if (!enabled || !turnIdRef.current) {
        return;
      }

      const strokePromise = emitPluginWithAck<{ ok: true }>(IMPOSTER_DRAW_STROKE_EVENT, {
        ...payload,
        turnId: turnIdRef.current,
      }).then(() => undefined);

      strokeReadyPromisesRef.current.set(payload.strokeId, strokePromise);
      await strokePromise;
    },
    [enabled],
  );

  const emitStrokePoints = useCallback(
    async (payload: Omit<ImposterDrawStrokePointsPayload, 'turnId'>) => {
      if (!enabled || !turnIdRef.current) {
        return;
      }

      const ready = strokeReadyPromisesRef.current.get(payload.strokeId);

      if (ready) {
        await ready;
      }

      getRoomSocket().emit(IMPOSTER_DRAW_STROKE_POINTS_EVENT, {
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

      void emitPluginWithAck<{ ok: true }>(IMPOSTER_DRAW_STROKE_EVENT, {
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
    isSubmittingAction,
    submitRoleUnderstood,
    undoStroke,
    submitVote,
    submitImageGuess,
    continueFromRoundResults,
    emitStroke,
    emitStrokePoints,
    emitStrokeEnd,
  };
}
