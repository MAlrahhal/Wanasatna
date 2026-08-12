'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type GuessPanelProps = {
  disabled?: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  feedbackMessage?: string | null;
  onSubmit: (guess: string) => void;
  className?: string;
};

export function GuessPanel({
  disabled = false,
  isSubmitting = false,
  errorMessage = null,
  feedbackMessage = null,
  onSubmit,
  className,
}: GuessPanelProps) {
  const [guess, setGuess] = useState('');
  const [shakeToken, setShakeToken] = useState(0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = guess.trim();

    if (!trimmed || disabled || isSubmitting) {
      return;
    }

    onSubmit(trimmed);
    setGuess('');
    setShakeToken((token) => token + 1);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'wanas-game-card flex flex-col gap-3 rounded-[1.25rem] p-4 sm:p-5',
        className,
      )}
    >
      <label htmlFor="draw-guess-input" className="text-sm font-semibold text-wanas-text-primary">
        خمّن الكلمة
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="draw-guess-input"
          type="text"
          value={guess}
          onChange={(event) => setGuess(event.target.value)}
          disabled={disabled || isSubmitting}
          placeholder="اكتب تخمينك هنا..."
          autoComplete="off"
          className={cn(
            'min-h-11 w-full flex-1 rounded-[var(--wanas-radius-control)] border border-wanas-border bg-[color:var(--wanas-game-card)] px-3.5 text-sm text-wanas-text-primary',
            'placeholder:text-wanas-text-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40',
            (disabled || isSubmitting) && 'cursor-not-allowed opacity-60',
          )}
        />
        <Button
          type="submit"
          size="md"
          disabled={disabled || isSubmitting || guess.trim().length === 0}
          loading={isSubmitting}
          className="sm:min-w-28"
        >
          إرسال
        </Button>
      </div>
      {disabled ? (
        <p className="text-xs text-wanas-text-muted">الرسام لا يمكنه التخمين.</p>
      ) : null}
      {feedbackMessage ? (
        <p
          key={shakeToken}
          className="animate-pulse text-sm font-medium text-wanas-accent-hover"
          role="status"
        >
          {feedbackMessage}
        </p>
      ) : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </form>
  );
}
