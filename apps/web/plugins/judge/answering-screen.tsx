'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { JUDGE_MAX_ANSWER_LENGTH } from '@wanasatna/shared';
import { GameScreen } from '@/components/game/game-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type JudgeAnsweringScreenProps = {
  prompt: string;
  isJudge: boolean;
  judgeName: string | null;
  canSubmit: boolean;
  hasSubmitted: boolean;
  submittedCount: number;
  totalSlots: number;
  isSubmitting: boolean;
  actionError?: string | null;
  onSubmit: (answer: string) => void;
};

export function JudgeAnsweringScreen({
  prompt,
  isJudge,
  judgeName,
  canSubmit,
  hasSubmitted,
  submittedCount,
  totalSlots,
  isSubmitting,
  actionError = null,
  onSubmit,
}: JudgeAnsweringScreenProps) {
  const [answer, setAnswer] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (canSubmit) {
      textareaRef.current?.focus();
    }
  }, [canSubmit, prompt]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed || !canSubmit || isSubmitting) {
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <GameScreen ariaLabel="أجب على السؤال" maxWidth="3xl">
      <div className="flex flex-col gap-6 sm:gap-8">
        <div className="text-center">
          <p className="text-sm font-semibold text-wanas-accent">⚖️ القاضي</p>
          {judgeName ? (
            <p className="mt-1 text-xs text-wanas-text-muted">القاضي: {judgeName}</p>
          ) : null}
        </div>

        <div className="wanas-game-card rounded-[2rem] px-5 py-10 text-center sm:px-10 sm:py-12">
          <p className="break-words text-2xl font-bold leading-snug tracking-tight text-wanas-text-primary min-[360px]:text-3xl sm:text-4xl">
            {prompt}
          </p>
        </div>

        {isJudge ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-8 text-center">
            <p className="text-lg font-semibold text-wanas-text-primary">
              أنت القاضي في هذه الجولة
            </p>
            <p className="mt-2 text-sm text-wanas-text-muted">بانتظار إجابات اللاعبين...</p>
            <p className="mt-4 text-sm tabular-nums text-wanas-text-muted">
              {submittedCount} / {totalSlots} أجابوا
            </p>
          </div>
        ) : hasSubmitted ? (
          <div className="wanas-game-card rounded-[1.25rem] px-5 py-8 text-center">
            <p className="text-lg font-semibold text-wanas-text-primary">تم إرسال إجابتك</p>
            <p className="mt-2 text-sm text-wanas-text-muted">بانتظار بقية اللاعبين...</p>
            <p className="mt-4 text-sm tabular-nums text-wanas-text-muted">
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
              rows={4}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="اكتب إجابتك هنا..."
              className={cn(
                'min-h-28 w-full resize-none rounded-xl border border-wanas-border bg-wanas-surface px-4 py-3',
                'text-base text-wanas-text-primary placeholder:text-wanas-text-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40',
              )}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs tabular-nums text-wanas-text-muted">
                {answer.trim().length} / {JUDGE_MAX_ANSWER_LENGTH}
              </p>
              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                disabled={!answer.trim() || !canSubmit}
              >
                إرسال الإجابة
              </Button>
            </div>
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          </form>
        )}
      </div>
    </GameScreen>
  );
}
