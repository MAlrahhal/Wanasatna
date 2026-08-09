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

  return (
    <GameScreen ariaLabel="القاضي يختار" maxWidth="4xl">
      <div className="flex flex-col gap-5 sm:gap-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-wanas-accent">⚖️ القاضي</p>
          <p className="mt-1 text-xs text-wanas-text-muted line-clamp-2">{prompt}</p>
          <p className="mt-3 text-sm font-semibold text-wanas-text-primary">
            {isJudge ? 'اختر أفضل إجابة' : 'القاضي يختار أفضل إجابة...'}
          </p>
        </div>

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

        {isJudge && canSelect && selectedAnswerId ? (
          <div className="flex justify-center">
            <Button
              type="button"
              size="lg"
              loading={isSubmitting}
              onClick={() => onSelectWinner(selectedAnswerId)}
              className="min-w-48"
            >
              اختيار هذه الإجابة
            </Button>
          </div>
        ) : null}

        {actionError ? (
          <p className="text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>
    </GameScreen>
  );
}
