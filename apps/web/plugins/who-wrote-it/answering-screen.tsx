'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { WHO_WROTE_IT_MAX_ANSWER_LENGTH } from '@wanasatna/shared';
import { AdPlacement } from '@/components/ads/ad-placement';
import { GameScreen } from '@/components/game/game-card';
import {
  GameMobileStickyCta,
  GameMobileStickyCtaSpacer,
} from '@/components/game/game-mobile-sticky-cta';
import { Button } from '@/components/ui/button';
import { shouldAutofocusFormField } from '@/lib/ui/should-autofocus-form-field';
import { cn } from '@/lib/utils';

export type WhoWroteItAnsweringScreenProps = {
  question: string;
  canSubmit: boolean;
  hasSubmitted: boolean;
  submittedCount: number;
  totalSlots: number;
  isSubmitting: boolean;
  isSpectator?: boolean;
  actionError?: string | null;
  onSubmit?: (answer: string) => void;
};

export function WhoWroteItAnsweringScreen({
  question,
  canSubmit,
  hasSubmitted,
  submittedCount,
  totalSlots,
  isSubmitting,
  isSpectator = false,
  actionError = null,
  onSubmit,
}: WhoWroteItAnsweringScreenProps) {
  const [answer, setAnswer] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (canSubmit && shouldAutofocusFormField()) {
      textareaRef.current?.focus();
    }
  }, [canSubmit, question]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed || !canSubmit || isSubmitting || !onSubmit) {
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <GameScreen ariaLabel="أجب على السؤال" maxWidth="3xl">
      <div className="flex flex-col gap-5 sm:gap-6">
        <div className="wanas-game-card rounded-[1.5rem] px-4 py-5 text-center sm:rounded-[1.75rem] sm:px-8 sm:py-10">
          <p className="text-wanas-text-primary break-words text-xl font-bold leading-snug tracking-tight min-[360px]:text-2xl sm:text-4xl">
            {question}
          </p>
        </div>

        {isSpectator ? null : hasSubmitted ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-6 text-center">
            <p className="text-wanas-text-primary text-lg font-semibold">تم إرسال إجابتك</p>
            <p className="text-wanas-text-muted mt-1.5 text-sm">بانتظار بقية اللاعبين...</p>
            <p className="text-wanas-text-muted mt-3 text-sm tabular-nums">
              {submittedCount} / {totalSlots} أجابوا
            </p>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="wanas-game-card flex flex-col gap-3 rounded-[1.25rem] p-4 sm:p-5"
            >
              <label
                htmlFor="who-wrote-it-answer"
                className="text-wanas-text-primary text-sm font-semibold"
              >
                إجابتك السرية
              </label>
              <textarea
                ref={textareaRef}
                id="who-wrote-it-answer"
                value={answer}
                maxLength={WHO_WROTE_IT_MAX_ANSWER_LENGTH}
                disabled={!canSubmit || isSubmitting}
                rows={3}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="اكتب إجابتك هنا..."
                className={cn(
                  'border-wanas-border bg-wanas-surface min-h-20 w-full resize-none rounded-xl border px-4 py-3',
                  'text-wanas-text-primary placeholder:text-wanas-text-muted text-base',
                  'focus-visible:ring-wanas-accent/40 focus-visible:outline-none focus-visible:ring-2',
                )}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-wanas-text-muted text-xs tabular-nums sm:text-sm">
                  {answer.trim().length} / {WHO_WROTE_IT_MAX_ANSWER_LENGTH}
                </p>
                <Button
                  type="submit"
                  size="lg"
                  className="hidden lg:inline-flex"
                  loading={isSubmitting}
                  disabled={!answer.trim() || !canSubmit}
                >
                  إرسال الإجابة
                </Button>
              </div>
              {actionError ? <p className="text-destructive text-sm">{actionError}</p> : null}
              <GameMobileStickyCtaSpacer />
              <GameMobileStickyCta>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  loading={isSubmitting}
                  disabled={!answer.trim() || !canSubmit}
                >
                  إرسال الإجابة
                </Button>
              </GameMobileStickyCta>
            </form>
            <AdPlacement placement="game-answer-input" />
          </>
        )}
      </div>
    </GameScreen>
  );
}
