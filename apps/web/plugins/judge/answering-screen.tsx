'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { JUDGE_MAX_ANSWER_LENGTH } from '@wanasatna/shared';
import { AdPlacement } from '@/components/ads/ad-placement';
import { GameScreen } from '@/components/game/game-card';
import {
  GameMobileStickyCta,
  GameMobileStickyCtaSpacer,
} from '@/components/game/game-mobile-sticky-cta';
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
          <p className="text-wanas-text-primary break-words text-lg font-bold leading-snug tracking-tight min-[360px]:text-xl sm:text-3xl">
            {prompt}
          </p>
        </div>

        {isSpectator ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-6 text-center">
            <p className="text-wanas-text-muted text-sm">اللاعبون يكتبون إجاباتهم...</p>
            <p className="text-wanas-text-muted mt-3 text-sm tabular-nums">
              {submittedCount} / {totalSlots} أجابوا
            </p>
          </div>
        ) : isJudge ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-6 text-center">
            <p className="text-wanas-text-primary text-lg font-semibold">
              أنت القاضي في هذه الجولة
            </p>
            <p className="text-wanas-text-muted mt-2 text-sm">بانتظار إجابات اللاعبين...</p>
            <p className="text-wanas-text-muted mt-3 text-sm tabular-nums">
              {submittedCount} / {totalSlots} أجابوا
            </p>
          </div>
        ) : hasSubmitted ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-6 text-center">
            <p className="text-wanas-text-primary text-lg font-semibold">تم إرسال إجابتك</p>
            <p className="text-wanas-text-muted mt-2 text-sm">بانتظار بقية اللاعبين...</p>
            <p className="text-wanas-text-muted mt-3 text-sm tabular-nums">
              {submittedCount} / {totalSlots} أجابوا
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="wanas-game-card flex flex-col gap-3 rounded-[1.25rem] p-4 sm:p-5"
          >
            <label htmlFor="judge-answer" className="text-wanas-text-primary text-sm font-semibold">
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
                'border-wanas-border bg-wanas-surface min-h-20 w-full resize-none rounded-xl border px-4 py-3',
                'text-wanas-text-primary placeholder:text-wanas-text-muted text-base',
                'focus-visible:ring-wanas-accent/40 focus-visible:outline-none focus-visible:ring-2',
              )}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-wanas-text-muted text-xs tabular-nums sm:text-sm">
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
        )}
        {!isSpectator && !isJudge ? <AdPlacement placement="gameplay-primary" /> : null}
      </div>
    </GameScreen>
  );
}
