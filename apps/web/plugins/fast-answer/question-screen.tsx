'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_GAME_ANSWER_LENGTH } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameMobileStickyCta, GameMobileStickyCtaSpacer } from '@/components/game/game-mobile-sticky-cta';
import { Button } from '@/components/ui/button';
import { shouldAutofocusFormField } from '@/lib/ui/should-autofocus-form-field';
import { cn } from '@/lib/utils';

export type FastAnswerQuestionScreenProps = {
  question: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  incorrectFeedback?: string | null;
  actionError?: string | null;
  onSubmit?: (answer: string) => void;
};

export function FastAnswerQuestionScreen({
  question,
  canSubmit,
  isSubmitting,
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
          <p className="break-words text-xl font-bold leading-snug tracking-tight text-wanas-text-primary min-[360px]:text-2xl sm:text-4xl">
            {question}
          </p>
        </div>

        {canSubmit ? (
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
                maxLength={MAX_GAME_ANSWER_LENGTH}
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
                className="hidden min-h-11 sm:min-w-28 lg:inline-flex"
              >
                إرسال
              </Button>
            </div>
            {incorrectFeedback ? (
              <p className="text-sm text-destructive">{incorrectFeedback}</p>
            ) : null}
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
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
