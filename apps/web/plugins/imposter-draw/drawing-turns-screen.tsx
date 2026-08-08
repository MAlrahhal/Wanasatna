'use client';

import { useState } from 'react';
import type {
  DrawGuessTool,
  DrawStroke,
  ImposterDrawReferenceImage,
  ImposterDrawStrokePayload,
  ImposterDrawStrokePointsPayload,
} from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';
import { DrawingCanvas } from '@/plugins/draw-guess/drawing-canvas';
import { DrawingToolbar } from '@/plugins/draw-guess/drawing-toolbar';

export type DrawingTurnsScreenProps = {
  strokes: readonly DrawStroke[];
  canDraw: boolean;
  role: 'crew' | 'impostor';
  referenceImage: ImposterDrawReferenceImage | null;
  currentDrawerName: string | null;
  remainingSeconds: number;
  currentRound: number;
  totalRounds: number;
  roomCode: string;
  actionError?: string | null;
  onClearCanvas: () => void;
  onEmitStroke: (payload: ImposterDrawStrokePayload) => void;
  onEmitStrokePoints: (payload: ImposterDrawStrokePointsPayload) => void;
  className?: string;
};

export function DrawingTurnsScreen({
  strokes,
  canDraw,
  role,
  referenceImage,
  currentDrawerName,
  remainingSeconds,
  currentRound,
  totalRounds,
  roomCode,
  actionError = null,
  onClearCanvas,
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
        phaseLabel="دور الرسم"
        timer={{ remainingSeconds, format: 'seconds', lowTimeThreshold: 3 }}
      />

      <div className="flex flex-col gap-4 sm:gap-5">
        <GameCard className="px-5 py-4 text-center sm:px-8">
          <p className="text-xs font-medium text-wanas-text-muted">دور</p>
          <p className="mt-1 text-2xl font-bold text-wanas-text-primary sm:text-3xl">
            {currentDrawerName ?? 'لاعب'}
          </p>
        </GameCard>

        <GameCard className="overflow-hidden px-0 py-0">
          {role === 'impostor' || !referenceImage ? (
            <div className="px-5 py-8 text-center sm:px-8 sm:py-10">
              <p className="text-4xl" aria-hidden>
                😈
              </p>
              <p className="mt-3 text-xl font-bold text-wanas-text-primary sm:text-2xl">
                أنت الإمبوستر
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-wanas-text-secondary">
                حاول الاندماج مع الرسم.
              </p>
            </div>
          ) : (
            <div className="px-5 py-5 text-center sm:px-8 sm:py-6">
              <p className="text-xs font-medium text-wanas-text-muted">الصورة</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceImage.imageUrl}
                alt={referenceImage.label}
                className="mx-auto mt-3 max-h-48 w-full max-w-md rounded-2xl border border-[color:var(--wanas-game-card-border)] object-contain"
              />
            </div>
          )}
        </GameCard>

        <DrawingCanvas
          strokes={strokes}
          readOnly={!canDraw}
          tool={tool}
          color={color}
          size={size}
          onStrokeStart={canDraw ? onEmitStroke : undefined}
          onStrokePoints={canDraw ? onEmitStrokePoints : undefined}
          onStrokeEnd={canDraw ? onEmitStroke : undefined}
        />

        {canDraw ? (
          <DrawingToolbar
            tool={tool}
            color={color}
            size={size}
            onToolChange={setTool}
            onColorChange={setColor}
            onSizeChange={setSize}
            onClear={onClearCanvas}
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
