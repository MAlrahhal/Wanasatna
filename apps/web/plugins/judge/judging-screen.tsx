'use client';

import { useState } from 'react';
import type { JudgeAnonymousAnswer } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
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
  isSpectator = false,
  actionError = null,
  onSelectWinner,
}: JudgeJudgingScreenProps) {
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);

  return (
    <GameScreen ariaLabel="القاضي يختار" maxWidth="4xl">
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="wanas-game-card rounded-[1.25rem] px-5 py-5 text-center sm:px-6">
          <p className="break-words text-lg font-bold leading-snug text-wanas-text-primary sm:text-xl">
            {prompt}
          </p>
        </div>

        {isJudge ? (
          <>
            <p className="text-center text-sm font-semibold text-wanas-text-primary">
              اختر أفضل إجابة
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {answers.map((answer) => (
                <JudgeAnswerCard
                  key={answer.answerId}
                  text={answer.text}
                  selectable={canSelect}
                  selected={selectedAnswerId === answer.answerId}
                  disabled={isSubmitting || !canSelect}
                  onSelect={() => setSelectedAnswerId(answer.answerId)}
                />
              ))}
            </div>
            {canSelect && selectedAnswerId ? (
              <div className="flex justify-center">
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
            ) : null}
          </>
        ) : (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-6 text-center">
            <p className="text-lg font-semibold text-wanas-text-primary">
              القاضي يختار أفضل إجابة...
            </p>
            {isSpectator && answers.length > 0 ? (
              <ul className="mt-4 space-y-1.5 text-right">
                {answers.map((answer) => (
                  <li
                    key={answer.answerId}
                    className="rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-2 text-sm text-wanas-text-primary"
                  >
                    «{answer.text}»
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    </GameScreen>
  );
}
