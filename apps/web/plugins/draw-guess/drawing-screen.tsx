'use client';

import { useState } from 'react';
import type {
  DrawGuessStrokePayload,
  DrawGuessStrokePointsPayload,
  DrawGuessTool,
  DrawStroke,
} from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { DRAW_GUESS_GAME_ICON, DRAW_GUESS_GAME_NAME } from '@/lib/game/draw-guess-brand';
import { DrawingCanvas } from './drawing-canvas';
import { DrawingToolbar } from './drawing-toolbar';
import { GuessPanel } from './guess-panel';

export type DrawingScreenProps = {
  strokes: readonly DrawStroke[];
  isDrawer: boolean;
  secretWord: string | null;
  drawerName: string;
  remainingSeconds: number;
  currentRound: number;
  totalRounds: number;
  roomCode: string;
  canGuess: boolean;
  isSubmittingAction?: boolean;
  actionError?: string | null;
  guessFeedback?: string | null;
  onSubmitGuess: (guess: string) => void;
  onClearCanvas: () => void;
  onUndo: () => void;
  onEmitStroke: (payload: Omit<DrawGuessStrokePayload, 'turnId'>) => void;
  onEmitStrokePoints: (payload: Omit<DrawGuessStrokePointsPayload, 'turnId'>) => void;
  className?: string;
};

export function DrawingScreen({
  strokes,
  isDrawer,
  secretWord,
  drawerName,
  remainingSeconds,
  currentRound,
  totalRounds,
  roomCode,
  canGuess,
  isSubmittingAction = false,
  actionError = null,
  guessFeedback = null,
  onSubmitGuess,
  onClearCanvas,
  onUndo,
  onEmitStroke,
  onEmitStrokePoints,
  className,
}: DrawingScreenProps) {
  const [tool, setTool] = useState<DrawGuessTool>('draw');
  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(8);

  return (
    <GameScreen ariaLabel="مرحلة الرسم" maxWidth="6xl" className={className}>
      <GameHeader
        gameName={DRAW_GUESS_GAME_NAME}
        gameIcon={DRAW_GUESS_GAME_ICON}
        roomCode={roomCode}
        currentRound={currentRound}
        totalRounds={totalRounds}
        phaseLabel="مرحلة الرسم"
        timer={{ remainingSeconds, format: 'seconds', lowTimeThreshold: 10 }}
      />

      <div className="flex flex-col gap-3 sm:gap-5">
        {isDrawer && secretWord ? (
          <GameCard className="px-4 py-2.5 text-center sm:px-8 sm:py-4">
            <p className="text-xs font-medium text-wanas-text-muted">الكلمة السرية</p>
            <p className="mt-1 break-words text-xl font-bold text-wanas-text-primary sm:mt-2 sm:text-3xl">
              {secretWord}
            </p>
          </GameCard>
        ) : (
          <GameCard className="px-4 py-2.5 text-center sm:px-8 sm:py-4">
            <p className="text-sm font-medium text-wanas-text-secondary">
              {drawerName} يرسم الآن — خمّن الكلمة!
            </p>
          </GameCard>
        )}

        <div className="flex flex-col gap-2">
          <DrawingCanvas
            strokes={strokes}
            readOnly={!isDrawer}
            tool={tool}
            color={color}
            size={size}
            onStrokeStart={isDrawer ? onEmitStroke : undefined}
            onStrokePoints={isDrawer ? onEmitStrokePoints : undefined}
            onStrokeEnd={isDrawer ? onEmitStroke : undefined}
          />

          {isDrawer ? (
            <DrawingToolbar
              tool={tool}
              color={color}
              size={size}
              disabled={isSubmittingAction}
              isClearing={isSubmittingAction}
              isUndoing={isSubmittingAction}
              onToolChange={setTool}
              onColorChange={setColor}
              onSizeChange={setSize}
              onUndo={onUndo}
              onClear={onClearCanvas}
            />
          ) : (
            <GuessPanel
              disabled={!canGuess}
              isSubmitting={isSubmittingAction}
              errorMessage={actionError}
              feedbackMessage={guessFeedback}
              onSubmit={onSubmitGuess}
            />
          )}
        </div>

        {isDrawer && actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    </GameScreen>
  );
}
