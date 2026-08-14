'use client';

import './countdown-screen.css';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { BARA_AL_SALAFA_GAME_ICON } from '@/lib/game/bara-al-salafa-brand';
import { cn } from '@/lib/utils';

export type CountdownNumber = 1 | 2 | 3;

export type CountdownScreenProps = {
  currentNumber: CountdownNumber;
  roundNumber: number;
  totalRounds: number;
  roomCode: string;
  gameName?: string;
  className?: string;
};

const countdownSteps: CountdownNumber[] = [3, 2, 1];

function CountdownPhaseDots({ currentNumber }: { currentNumber: CountdownNumber }) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={4 - currentNumber}
      aria-label={`العد التنازلي ${currentNumber}`}
    >
      {countdownSteps.map((step) => {
        const isActive = step === currentNumber;
        const isPast = step > currentNumber;

        return (
          <span
            key={step}
            className={cn(
              'rounded-full transition-colors duration-200',
              isActive ? 'size-2.5 bg-wanas-accent' : 'size-2',
              !isActive && isPast ? 'bg-wanas-primary/70' : null,
              !isActive && !isPast ? 'bg-wanas-border' : null,
            )}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

export function CountdownScreen({
  currentNumber,
  roundNumber,
  totalRounds,
  roomCode,
  gameName = 'برا السالفة',
  className,
}: CountdownScreenProps) {
  return (
    <GameScreen
      ariaLabel="العد التنازلي قبل بدء الجولة"
      maxWidth="3xl"
      className={cn('flex min-h-[min(62vh,560px)] flex-col', className)}
    >
      <GameHeader
        gameName={gameName}
        gameIcon={BARA_AL_SALAFA_GAME_ICON}
        roomCode={roomCode}
        currentRound={roundNumber}
        totalRounds={totalRounds}
        phaseLabel="العد التنازلي"
      />

      <div className="flex flex-1 flex-col items-center justify-center py-6 sm:py-10">
        <GameCard className="flex w-full max-w-md flex-col items-center px-6 py-9 text-center sm:px-10 sm:py-12">
          <h2 className="text-2xl font-semibold text-wanas-text-primary sm:text-3xl">استعدوا</h2>

          <div className="bara-countdown-ring relative mt-6 flex size-[9rem] items-center justify-center min-[360px]:size-[10.5rem] sm:mt-8 sm:size-[12.5rem]">
            <p
              key={currentNumber}
              className="bara-countdown-number font-mono text-[4.75rem] leading-none font-bold tabular-nums text-wanas-primary-dark min-[360px]:text-[5.5rem] sm:text-[6.5rem]"
              aria-live="polite"
              aria-atomic="true"
            >
              {currentNumber}
            </p>
          </div>

          <p className="mt-8 text-base font-medium text-wanas-text-secondary sm:mt-10 sm:text-lg">
            بتبدأ الجولة الآن
          </p>
        </GameCard>
      </div>

      <footer className="pb-1 pt-2">
        <CountdownPhaseDots currentNumber={currentNumber} />
      </footer>
    </GameScreen>
  );
}
