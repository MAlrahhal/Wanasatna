'use client';

import { useState } from 'react';
import type {
  DrawGuessTool,
  DrawStroke,
  ImposterDrawStrokePayload,
  ImposterDrawStrokePointsPayload,
} from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { SpectatorNotice } from '@/components/room/room-system-state';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';
import { DrawingCanvas } from '@/plugins/draw-guess/drawing-canvas';
import { DrawingToolbar } from '@/plugins/draw-guess/drawing-toolbar';

export type DrawingTurnsScreenProps = {
  strokes: readonly DrawStroke[];
  canDraw: boolean;
  isSpectator?: boolean;
  currentDrawerName: string | null;
  remainingSeconds: number;
  currentRound: number;
  totalRounds: number;
  roomCode: string;
  actionError?: string | null;
  onUndo?: () => void;
  onEmitStroke?: (payload: Omit<ImposterDrawStrokePayload, 'turnId'>) => void;
  onEmitStrokePoints?: (payload: Omit<ImposterDrawStrokePointsPayload, 'turnId'>) => void;
  className?: string;
};

export function DrawingTurnsScreen({
  strokes,
  canDraw,
  isSpectator = false,
  currentDrawerName,
  remainingSeconds,
  currentRound,
  totalRounds,
  roomCode,
  actionError = null,
  onUndo,
  onEmitStroke,
  onEmitStrokePoints,
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
        timer={{ remainingSeconds, format: 'seconds', lowTimeThreshold: 3 }}
      />

      <div className="flex flex-col gap-4 sm:gap-5">
        {isSpectator ? <SpectatorNotice /> : null}
        <GameCard className="px-5 py-4 text-center sm:px-8">
          <p className="text-xs font-medium text-wanas-text-muted">دور</p>
          <p className="mt-1 text-2xl font-bold text-wanas-text-primary sm:text-3xl">
            {currentDrawerName ?? 'لاعب'}
          </p>
        </GameCard>

        <DrawingCanvas
          strokes={strokes}
          readOnly={!canDraw}
          tool={tool}
          color={color}
          size={size}
          onStrokeStart={canDraw && onEmitStroke ? onEmitStroke : undefined}
          onStrokePoints={canDraw && onEmitStrokePoints ? onEmitStrokePoints : undefined}
          onStrokeEnd={canDraw && onEmitStroke ? onEmitStroke : undefined}
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

        {actionError ? (
          <p className="text-center text-sm text-destructive" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>
    </GameScreen>
  );
}
