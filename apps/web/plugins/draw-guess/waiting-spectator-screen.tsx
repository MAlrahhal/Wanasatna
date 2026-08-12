'use client';

import type { DrawStroke } from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { DRAW_GUESS_GAME_ICON, DRAW_GUESS_GAME_NAME } from '@/lib/game/draw-guess-brand';
import { DrawingCanvas } from './drawing-canvas';

export type WaitingSpectatorScreenProps = {
  strokes: readonly DrawStroke[];
  drawerName: string;
  remainingSeconds: number;
  currentRound: number;
  totalRounds: number;
  roomCode: string;
};

export function WaitingSpectatorScreen({
  strokes,
  drawerName,
  remainingSeconds,
  currentRound,
  totalRounds,
  roomCode,
}: WaitingSpectatorScreenProps) {
  return (
    <GameScreen ariaLabel="مشاهدة الجولة" maxWidth="6xl">
      <GameHeader
        gameName={DRAW_GUESS_GAME_NAME}
        gameIcon={DRAW_GUESS_GAME_ICON}
        roomCode={roomCode}
        currentRound={currentRound}
        totalRounds={totalRounds}
        phaseLabel="الجولة جارية"
        timer={{ remainingSeconds, format: 'seconds', lowTimeThreshold: 10 }}
      />

      <div className="flex flex-col gap-4 sm:gap-5">
        <GameCard className="px-5 py-5 text-center sm:px-8">
          <p className="text-lg font-semibold text-wanas-text-primary">الجولة جارية 👀</p>
          <p className="mt-2 text-sm text-wanas-text-secondary">
            أنت حالياً مشاهد، وبتشارك في المباراة القادمة.
          </p>
          <p className="mt-3 text-xs text-wanas-text-muted">{drawerName} يرسم الآن</p>
        </GameCard>

        <DrawingCanvas strokes={strokes} readOnly />
      </div>
    </GameScreen>
  );
}
