'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_GAME_ANSWER_LENGTH } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import {
  GameMobileStickyCta,
  GameMobileStickyCtaSpacer,
} from '@/components/game/game-mobile-sticky-cta';
import { Button } from '@/components/ui/button';
import { shouldAutofocusFormField } from '@/lib/ui/should-autofocus-form-field';
import { cn } from '@/lib/utils';

export type FastAnswerQuestionScreenProps = {
  question: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  correctPlacement?: number | null;
  correctPoints?: number;
  incorrectFeedback?: string | null;
  actionError?: string | null;
  onSubmit?: (answer: string) => void;
};

export function FastAnswerQuestionScreen({
  question,
  canSubmit,
  isSubmitting,
  correctPlacement = null,
  correctPoints = 0,
  incorrectFeedback = null,
  actionError = null,
  onSubmit,
}: FastAnswerQuestionScreenProps) {
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shouldAutofocusFormField()) {
      inputRef.current?.focus();
    }
  }, [question]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = answer.trim();

    if (!trimmed || !canSubmit || isSubmitting || !onSubmit) {
      return;
    }

    onSubmit(trimmed);
    setAnswer('');
  }

  return (
    <GameScreen ariaLabel="سؤال أسرع إجابة" maxWidth="3xl">
      <div className="flex flex-col gap-5 sm:gap-6">
        <div className="wanas-game-card rounded-[1.5rem] px-4 py-5 text-center sm:rounded-[2rem] sm:px-8 sm:py-10">
          <p className="text-wanas-text-primary break-words text-xl font-bold leading-snug tracking-tight min-[360px]:text-2xl sm:text-4xl">
            {question}
          </p>
          <p className="text-wanas-text-secondary mt-3 text-sm font-medium">
            تستمر الجولة حتى يجيب جميع اللاعبين إجابة صحيحة أو ينتهي الوقت.
          </p>
        </div>

        {correctPlacement !== null ? (
          <div
            role="status"
            aria-live="polite"
            className="wanas-game-card border-wanas-success-border/80 bg-wanas-success-surface rounded-[1.25rem] px-4 py-4 text-center"
            data-testid="fast-answer-placement"
          >
            <p className="text-wanas-success-dark text-lg font-bold">
              {fastAnswerPlacementLabel(correctPlacement, correctPoints)}
            </p>
            <p className="text-wanas-text-secondary mt-1 text-sm">
              تم تثبيت نتيجتك لهذه الجولة. انتظر بقية اللاعبين.
            </p>
          </div>
        ) : null}

        {canSubmit ? (
          <form
            onSubmit={handleSubmit}
            className="wanas-game-card flex flex-col gap-3 rounded-[1.25rem] p-4 sm:p-5"
          >
            <label
              htmlFor="fast-answer-input"
              className="text-wanas-text-primary text-sm font-semibold"
            >
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
                maxLength={MAX_GAME_ANSWER_LENGTH}
                autoComplete="off"
                className={cn(
                  'border-wanas-border text-wanas-text-primary min-h-11 w-full flex-1 rounded-[var(--wanas-radius-control)] border bg-[color:var(--wanas-game-card)] px-3.5 text-sm',
                  'placeholder:text-wanas-text-muted',
                  'focus-visible:ring-wanas-accent/40 focus-visible:outline-none focus-visible:ring-2',
                  (!canSubmit || isSubmitting) && 'cursor-not-allowed opacity-60',
                )}
              />
              <Button
                type="submit"
                size="md"
                disabled={!canSubmit || isSubmitting || answer.trim().length === 0}
                loading={isSubmitting}
                className="hidden min-h-11 sm:min-w-28 lg:inline-flex"
              >
                إرسال
              </Button>
            </div>
            {incorrectFeedback ? (
              <p className="text-destructive text-sm">{incorrectFeedback}</p>
            ) : null}
            {actionError ? <p className="text-destructive text-sm">{actionError}</p> : null}
            <GameMobileStickyCtaSpacer />
            <GameMobileStickyCta>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!canSubmit || isSubmitting || answer.trim().length === 0}
                loading={isSubmitting}
              >
                إرسال
              </Button>
            </GameMobileStickyCta>
          </form>
        ) : null}
      </div>
    </GameScreen>
  );
}

export function fastAnswerPlacementLabel(placement: number, points: number): string {
  if (placement === 1) {
    return `المركز الأول — ${points} نقطة`;
  }
  if (placement === 2) {
    return `المركز الثاني — ${points} نقطة`;
  }
  if (placement === 3) {
    return `المركز الثالث — ${points} نقطة`;
  }
  return `إجابة صحيحة — ${points} نقطة`;
}
