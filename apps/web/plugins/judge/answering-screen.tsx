'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { JUDGE_MAX_ANSWER_LENGTH } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { GameMobileStickyCta, GameMobileStickyCtaSpacer } from '@/components/game/game-mobile-sticky-cta';
import { Button } from '@/components/ui/button';
import { shouldAutofocusFormField } from '@/lib/ui/should-autofocus-form-field';
import { cn } from '@/lib/utils';

export type JudgeAnsweringScreenProps = {
  prompt: string;
  isJudge: boolean;
  canSubmit: boolean;
  hasSubmitted: boolean;
  submittedCount: number;
  totalSlots: number;
  isSubmitting: boolean;
  isSpectator?: boolean;
  actionError?: string | null;
  onSubmit?: (answer: string) => void;
};

export function JudgeAnsweringScreen({
  prompt,
  isJudge,
  canSubmit,
  hasSubmitted,
  submittedCount,
  totalSlots,
  isSubmitting,
  isSpectator = false,
  actionError = null,
  onSubmit,
}: JudgeAnsweringScreenProps) {
  const [answer, setAnswer] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (canSubmit && shouldAutofocusFormField()) {
      textareaRef.current?.focus();
    }
  }, [canSubmit, prompt]);

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
        <div className="wanas-game-card rounded-[1.25rem] px-4 py-4 text-center sm:rounded-[1.5rem] sm:px-8 sm:py-8">
          <p className="break-words text-lg font-bold leading-snug tracking-tight text-wanas-text-primary min-[360px]:text-xl sm:text-3xl">
            {prompt}
          </p>
        </div>

        {isSpectator ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-6 text-center">
            <p className="text-sm text-wanas-text-muted">اللاعبون يكتبون إجاباتهم...</p>
            <p className="mt-3 text-sm tabular-nums text-wanas-text-muted">
              {submittedCount} / {totalSlots} أجابوا
            </p>
          </div>
        ) : isJudge ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-6 text-center">
            <p className="text-lg font-semibold text-wanas-text-primary">
              أنت القاضي في هذه الجولة
            </p>
            <p className="mt-2 text-sm text-wanas-text-muted">بانتظار إجابات اللاعبين...</p>
            <p className="mt-3 text-sm tabular-nums text-wanas-text-muted">
              {submittedCount} / {totalSlots} أجابوا
            </p>
          </div>
        ) : hasSubmitted ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-6 text-center">
            <p className="text-lg font-semibold text-wanas-text-primary">تم إرسال إجابتك</p>
            <p className="mt-2 text-sm text-wanas-text-muted">بانتظار بقية اللاعبين...</p>
            <p className="mt-3 text-sm tabular-nums text-wanas-text-muted">
              {submittedCount} / {totalSlots} أجابوا
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="wanas-game-card flex flex-col gap-3 rounded-[1.25rem] p-4 sm:p-5"
          >
            <label htmlFor="judge-answer" className="text-sm font-semibold text-wanas-text-primary">
              إجابتك
            </label>
            <textarea
              ref={textareaRef}
              id="judge-answer"
              value={answer}
              maxLength={JUDGE_MAX_ANSWER_LENGTH}
              disabled={!canSubmit || isSubmitting}
              rows={3}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="اكتب إجابتك هنا..."
              className={cn(
                'min-h-20 w-full resize-none rounded-xl border border-wanas-border bg-wanas-surface px-4 py-3',
                'text-base text-wanas-text-primary placeholder:text-wanas-text-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40',
              )}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tabular-nums text-wanas-text-muted sm:text-sm">
                {answer.trim().length} / {JUDGE_MAX_ANSWER_LENGTH}
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
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
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
        )}
      </div>
    </GameScreen>
  );
}
