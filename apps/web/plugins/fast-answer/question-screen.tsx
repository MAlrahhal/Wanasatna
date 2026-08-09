'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GameScreen } from '@/components/game/game-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FastAnswerQuestionScreenProps = {
  question: string;
  remainingSeconds: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  incorrectFeedback?: string | null;
  actionError?: string | null;
  onSubmit: (answer: string) => void;
};

export function FastAnswerQuestionScreen({
  question,
  remainingSeconds,
  canSubmit,
  isSubmitting,
  incorrectFeedback = null,
  actionError = null,
  onSubmit,
}: FastAnswerQuestionScreenProps) {
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [question]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = answer.trim();

    if (!trimmed || !canSubmit || isSubmitting) {
      return;
    }

    onSubmit(trimmed);
    setAnswer('');
  }

  const urgent = remainingSeconds <= 5;

  return (
    <GameScreen ariaLabel="سؤال أسرع إجابة" maxWidth="3xl">
      <div className="flex flex-col gap-6 sm:gap-8">
        <div className="text-center">
          <p
            className={cn(
              'text-sm font-semibold tabular-nums',
              urgent ? 'text-destructive' : 'text-wanas-text-muted',
            )}
          >
            الوقت المتبقي: {remainingSeconds} ث
          </p>
        </div>

        <div className="wanas-game-card rounded-[2rem] px-5 py-10 text-center sm:px-10 sm:py-14">
          <p className="break-words text-2xl font-bold leading-snug tracking-tight text-wanas-text-primary min-[360px]:text-3xl sm:text-4xl">
            {question}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="wanas-game-card flex flex-col gap-3 rounded-[1.25rem] p-4 sm:p-5"
        >
          <label htmlFor="fast-answer-input" className="text-sm font-semibold text-wanas-text-primary">
            إجابتك
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={inputRef}
              id="fast-answer-input"
              type="text"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={!canSubmit || isSubmitting}
              placeholder="اكتب الإجابة هنا..."
              autoComplete="off"
              className={cn(
                'min-h-11 w-full flex-1 rounded-[var(--wanas-radius-control)] border border-wanas-border bg-[color:var(--wanas-game-card)] px-3.5 text-sm text-wanas-text-primary',
                'placeholder:text-wanas-text-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40',
                (!canSubmit || isSubmitting) && 'cursor-not-allowed opacity-60',
              )}
            />
            <Button
              type="submit"
              size="md"
              disabled={!canSubmit || isSubmitting || answer.trim().length === 0}
              loading={isSubmitting}
              className="sm:min-w-28"
            >
              إرسال
            </Button>
          </div>
          {incorrectFeedback ? (
            <p className="text-sm text-destructive">{incorrectFeedback}</p>
          ) : null}
          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
        </form>
      </div>
    </GameScreen>
  );
}
