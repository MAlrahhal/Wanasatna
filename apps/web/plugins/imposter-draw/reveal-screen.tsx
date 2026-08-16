'use client';

import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader, resolveHeaderTimer } from '@/components/game/game-header';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';

export type ImposterDrawRevealScreenProps = {
  impostorName: string;
  impostorPlayerId: string;
  impostorVotedOut: boolean | null;
  remainingSeconds: number;
  deadlineAtMs?: number | null;
  currentRound: number;
  totalRounds: number;
  roomCode: string;
  className?: string;
};

export function ImposterDrawRevealScreen({
  impostorName,
  impostorPlayerId,
  impostorVotedOut,
  remainingSeconds,
  deadlineAtMs,
  currentRound,
  totalRounds,
  roomCode,
  className,
}: ImposterDrawRevealScreenProps) {
  const avatarColors = getPlayerAvatarColors(impostorPlayerId);

  return (
    <GameScreen ariaLabel="كشف الإمبوستر" maxWidth="4xl" className={className}>
      <GameHeader
        gameName={IMPOSTER_DRAW_GAME_NAME}
        gameIcon={IMPOSTER_DRAW_GAME_ICON}
        roomCode={roomCode}
        currentRound={currentRound}
        totalRounds={totalRounds}
        phaseLabel="الكشف"
        timer={resolveHeaderTimer({
          deadlineAtMs,
          remainingSeconds,
          format: 'seconds',
          lowTimeThreshold: 2,
        })}
      />

      <GameCard className="border-wanas-error-border/70 px-5 py-10 text-center sm:px-8">
        <div
          className="mx-auto flex size-24 items-center justify-center rounded-full text-3xl font-semibold"
          style={{ backgroundColor: avatarColors.bg, color: avatarColors.text }}
        >
          {impostorName.charAt(0)}
        </div>
        <p className="mt-5 text-2xl font-bold text-wanas-text-primary sm:text-3xl">
          الإمبوستر هو: {impostorName}
        </p>
        <p className="mt-4 text-sm text-wanas-text-secondary">
          {impostorVotedOut ? 'تم كشف الإمبوستر بالتصويت.' : 'نجا الإمبوستر من التصويت.'}
        </p>
      </GameCard>
    </GameScreen>
  );
}
