'use client';

import { useState, type RefObject } from 'react';
import type {
  DrawGuessTool,
  DrawStroke,
  ImposterDrawStrokePayload,
  ImposterDrawStrokePointsPayload,
} from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader, resolveHeaderTimer } from '@/components/game/game-header';
import { SpectatorNotice } from '@/components/room/room-system-state';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';
import { DrawingCanvas, type DrawingCanvasHandle } from '@/plugins/draw-guess/drawing-canvas';
import { DrawingToolbar } from '@/plugins/draw-guess/drawing-toolbar';

export type DrawingTurnsScreenProps = {
  strokes: readonly DrawStroke[];
  currentTurnStrokeIds?: readonly string[];
  turnId?: string;
  canDraw: boolean;
  isSpectator?: boolean;
  currentDrawerName: string | null;
  remainingSeconds: number;
  deadlineAtMs?: number | null;
  currentRound: number;
  totalRounds: number;
  roomCode: string;
  actionError?: string | null;
  onUndo?: () => void;
  onEmitStroke?: (payload: Omit<ImposterDrawStrokePayload, 'turnId'>) => void;
  onEmitStrokePoints?: (payload: Omit<ImposterDrawStrokePointsPayload, 'turnId'>) => void;
  onEmitStrokeEnd?: (payload: { strokeId: string }) => void;
  canvasRef?: RefObject<DrawingCanvasHandle | null>;
  className?: string;
};

export function DrawingTurnsScreen({
  strokes,
  currentTurnStrokeIds,
  turnId,
  canDraw,
  isSpectator = false,
  currentDrawerName,
  remainingSeconds,
  deadlineAtMs,
  currentRound,
  totalRounds,
  roomCode,
  actionError = null,
  onUndo,
  onEmitStroke,
  onEmitStrokePoints,
  onEmitStrokeEnd,
  canvasRef,
  className,
}: DrawingTurnsScreenProps) {
  const [tool, setTool] = useState<DrawGuessTool>('draw');
  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(8);

  return (
    <GameScreen ariaLabel="أدوار الرسم" maxWidth="6xl" className={className}>
      <GameHeader
        gameName={IMPOSTER_DRAW_GAME_NAME}
        gameIcon={IMPOSTER_DRAW_GAME_ICON}
        roomCode={roomCode}
        currentRound={currentRound}
        totalRounds={totalRounds}
        phaseLabel={isSpectator ? 'مشاهدة' : 'دور الرسم'}
        timer={resolveHeaderTimer({
          deadlineAtMs,
          remainingSeconds,
          format: 'seconds',
          lowTimeThreshold: 3,
        })}
      />

      <div className="flex flex-col gap-3 sm:gap-5">
        {isSpectator ? <SpectatorNotice /> : null}
        <GameCard className="px-4 py-2.5 text-center sm:px-8 sm:py-4">
          <p className="text-xs font-medium text-wanas-text-muted">دور</p>
          <p className="mt-1 text-xl font-bold text-wanas-text-primary sm:text-3xl">
            {currentDrawerName ?? 'لاعب'}
          </p>
        </GameCard>

        <div className="flex flex-col gap-2">
          <DrawingCanvas
            ref={canvasRef}
            strokes={strokes}
            currentTurnStrokeIds={currentTurnStrokeIds}
            turnId={turnId}
            readOnly={!canDraw}
            tool={tool}
            color={color}
            size={size}
            onStrokeStart={canDraw && onEmitStroke ? onEmitStroke : undefined}
            onStrokePoints={canDraw && onEmitStrokePoints ? onEmitStrokePoints : undefined}
            onStrokeEnd={canDraw && onEmitStrokeEnd ? onEmitStrokeEnd : undefined}
          />

          {canDraw ? (
            <DrawingToolbar
              tool={tool}
              color={color}
              size={size}
              onToolChange={setTool}
              onColorChange={setColor}
              onSizeChange={setSize}
              onUndo={onUndo}
            />
          ) : null}
        </div>

        {actionError ? (
          <p className="text-center text-sm text-destructive" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
    </GameScreen>
  );
}
