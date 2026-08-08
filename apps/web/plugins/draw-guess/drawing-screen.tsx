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
  onSubmitGuess: (guess: string) => void;
  onClearCanvas: () => void;
  onEmitStroke: (payload: DrawGuessStrokePayload) => void;
  onEmitStrokePoints: (payload: DrawGuessStrokePointsPayload) => void;
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
  onSubmitGuess,
  onClearCanvas,
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

      <div className="flex flex-col gap-4 sm:gap-5">
        {isDrawer && secretWord ? (
          <GameCard className="px-5 py-4 text-center sm:px-8">
            <p className="text-xs font-medium text-wanas-text-muted">الكلمة السرية</p>
            <p className="mt-2 break-words text-2xl font-bold text-wanas-text-primary sm:text-3xl">
              {secretWord}
            </p>
          </GameCard>
        ) : (
          <GameCard className="px-5 py-4 text-center sm:px-8">
            <p className="text-sm font-medium text-wanas-text-secondary">
              {drawerName} يرسم الآن — خمّن الكلمة!
            </p>
          </GameCard>
        )}

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
            onToolChange={setTool}
            onColorChange={setColor}
            onSizeChange={setSize}
            onClear={onClearCanvas}
          />
        ) : (
          <GuessPanel
            disabled={!canGuess}
            isSubmitting={isSubmittingAction}
            errorMessage={actionError}
            onSubmit={onSubmitGuess}
          />
        )}

        {isDrawer && actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    </GameScreen>
  );
}
