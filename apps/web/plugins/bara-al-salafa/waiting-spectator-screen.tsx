'use client';

import { GameScreen } from '@/components/game/game-card';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';

export type WaitingSpectatorScreenProps = {
  className?: string;
};

export function WaitingSpectatorScreen({ className }: WaitingSpectatorScreenProps) {
  return (
    <GameScreen ariaLabel="مشاهد في الجولة" maxWidth="3xl" className={className}>
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center sm:py-20">
        <span
          className="flex size-14 items-center justify-center rounded-2xl bg-[color:var(--wanas-game-card)] text-2xl shadow-sm ring-1 ring-[color:var(--wanas-game-card-border)] sm:size-16 sm:text-3xl"
          aria-hidden
        >
          {BARA_AL_SALAFA_GAME_ICON}
        </span>

        <h2 className="mt-6 text-2xl font-semibold text-wanas-text-primary sm:text-3xl">
          الجولة جارية 👀
        </h2>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-wanas-text-secondary sm:text-base">
          أنت حالياً مشاهد، وبتقدر تلعب في المباراة القادمة.
        </p>
      </div>
    </GameScreen>
  );
}
