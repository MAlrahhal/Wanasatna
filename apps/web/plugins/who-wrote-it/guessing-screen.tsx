'use client';

import type { WhoWroteItAnonymousAnswer, WhoWroteItPlayerOption } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WhoWroteItGuessingScreenProps = {
  currentAnswer: WhoWroteItAnonymousAnswer | null;
  options: readonly WhoWroteItPlayerOption[];
  progressIndex: number;
  progressTotal: number;
  isOwnAnswer: boolean;
  hasGuessedCurrent: boolean;
  canSubmitGuess: boolean;
  currentGuessCount: number;
  requiredGuessCount: number;
  isSubmitting: boolean;
  isSpectator?: boolean;
  actionError?: string | null;
  onGuess: (answerId: string, ownerPlayerId: string) => void;
};

export function WhoWroteItGuessingScreen({
  currentAnswer,
  options,
  progressIndex,
  progressTotal,
  isOwnAnswer,
  hasGuessedCurrent,
  canSubmitGuess,
  currentGuessCount,
  requiredGuessCount,
  isSubmitting,
  isSpectator = false,
  actionError = null,
  onGuess,
}: WhoWroteItGuessingScreenProps) {
  if (!currentAnswer) {
    return (
      <GameScreen ariaLabel="بانتظار التخمينات" maxWidth="3xl">
        <div className="wanas-game-card rounded-[1.75rem] px-6 py-10 text-center">
          <p className="text-sm text-wanas-text-muted">بانتظار بقية اللاعبين...</p>
        </div>
      </GameScreen>
    );
  }

  return (
    <GameScreen ariaLabel="من كتب هذه الإجابة؟" maxWidth="3xl">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="wanas-game-card rounded-[1.75rem] px-5 py-8 text-center sm:px-8 sm:py-10">
          <p className="break-words text-2xl font-bold leading-snug text-wanas-text-primary sm:text-3xl">
            «{currentAnswer.text}»
          </p>
        </div>

        {isSpectator ? null : isOwnAnswer ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-5 text-center">
            <p className="text-base font-semibold text-wanas-text-primary">هذه إجابتك</p>
            <p className="mt-1.5 text-sm text-wanas-text-muted">
              بانتظار تخمينات بقية اللاعبين...
            </p>
            {requiredGuessCount > 0 ? (
              <p className="mt-3 text-sm tabular-nums text-wanas-text-muted">
                {currentGuessCount} / {requiredGuessCount} خمنوا
              </p>
            ) : null}
          </div>
        ) : hasGuessedCurrent || !canSubmitGuess ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-5 text-center">
            <p className="text-base font-semibold text-wanas-text-primary">تم إرسال تخمينك</p>
            <p className="mt-1.5 text-sm text-wanas-text-muted">بانتظار بقية اللاعبين...</p>
            {requiredGuessCount > 0 ? (
              <p className="mt-3 text-sm tabular-nums text-wanas-text-muted">
                {currentGuessCount} / {requiredGuessCount} خمنوا
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="mb-3 text-center text-sm font-semibold text-wanas-text-primary">
              من تتوقع كتب هذه الإجابة؟
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {options.map((option) => (
                <Button
                  key={option.playerId}
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={isSubmitting}
                  onClick={() => onGuess(currentAnswer.answerId, option.playerId)}
                  className={cn(
                    'h-11 min-h-11 whitespace-normal break-words px-3 text-sm sm:h-12 sm:text-base',
                  )}
                >
                  {option.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-sm tabular-nums text-wanas-text-muted">
          {progressIndex} من {progressTotal}
        </p>

        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    </GameScreen>
  );
}
