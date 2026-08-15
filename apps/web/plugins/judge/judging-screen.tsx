'use client';

import { useState } from 'react';
import type { JudgeAnonymousAnswer } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameMobileStickyCta, GameMobileStickyCtaSpacer } from '@/components/game/game-mobile-sticky-cta';
import { Button } from '@/components/ui/button';
import { JudgeAnswerCard } from './judge-answer-card';

export type JudgeJudgingScreenProps = {
  prompt: string;
  answers: readonly JudgeAnonymousAnswer[];
  isJudge: boolean;
  canSelect: boolean;
  isSubmitting: boolean;
  isSpectator?: boolean;
  actionError?: string | null;
  onSelectWinner: (answerId: string) => void;
};

export function JudgeJudgingScreen({
  prompt,
  answers,
  isJudge,
  canSelect,
  isSubmitting,
  actionError = null,
  onSelectWinner,
}: JudgeJudgingScreenProps) {
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const canInteract = isJudge && canSelect && !isSubmitting;

  return (
    <GameScreen ariaLabel="القاضي يختار" maxWidth="4xl">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="wanas-game-card rounded-[1.25rem] px-4 py-4 text-center sm:px-6 sm:py-5">
          <p className="break-words text-base font-bold leading-snug text-wanas-text-primary sm:text-xl">
            {prompt}
          </p>
        </div>

        <p className="text-center text-sm font-semibold text-wanas-text-primary">
          {isJudge ? 'اختر أفضل إجابة' : 'القاضي يختار أفضل إجابة...'}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {answers.map((answer) => (
            <JudgeAnswerCard
              key={answer.answerId}
              text={answer.text}
              selectable={canInteract}
              selected={canInteract && selectedAnswerId === answer.answerId}
              disabled={!canInteract}
              onSelect={canInteract ? () => setSelectedAnswerId(answer.answerId) : undefined}
            />
          ))}
        </div>

        {canInteract && selectedAnswerId ? (
          <>
            <div className="hidden justify-center lg:flex">
              <Button
                type="button"
                size="lg"
                loading={isSubmitting}
                onClick={() => onSelectWinner(selectedAnswerId)}
                className="min-h-12 min-w-48"
              >
                تأكيد الاختيار
              </Button>
            </div>
            <GameMobileStickyCtaSpacer />
            <GameMobileStickyCta>
              <Button
                type="button"
                size="lg"
                className="w-full"
                loading={isSubmitting}
                onClick={() => onSelectWinner(selectedAnswerId)}
              >
                تأكيد الاختيار
              </Button>
            </GameMobileStickyCta>
          </>
        ) : null}

        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    </GameScreen>
  );
}
