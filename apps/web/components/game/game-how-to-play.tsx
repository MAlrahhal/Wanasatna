'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  HOW_TO_PLAY_BUTTON_LABEL,
  getHowToPlayGuide,
  type HowToPlayGuide,
} from '@/lib/game/how-to-play';
import { cn } from '@/lib/utils';

type GameHowToPlayControlProps = {
  gameId: string | null | undefined;
  compact?: boolean;
  className?: string;
};

export function GameHowToPlayControl({ gameId, compact = false, className }: GameHowToPlayControlProps) {
  const guide = getHowToPlayGuide(gameId);
  const [open, setOpen] = useState(false);

  if (!guide) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={cn(
          'border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] text-[color:var(--wanas-game-text-primary)]',
          compact
            ? 'min-h-11 px-2.5 text-xs md:min-h-9'
            : 'min-h-9 px-2.5 text-xs sm:text-sm',
          className,
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="game-how-to-play-button"
        onClick={() => setOpen(true)}
      >
        {HOW_TO_PLAY_BUTTON_LABEL}
      </Button>
      <GameHowToPlayDialog open={open} guide={guide} onClose={() => setOpen(false)} />
    </>
  );
}

type GameHowToPlayDialogProps = {
  open: boolean;
  guide: HowToPlayGuide;
  onClose: () => void;
};

export function GameHowToPlayDialog({ open, guide, onClose }: GameHowToPlayDialogProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 bg-wanas-text-primary/50"
        data-testid="game-how-to-play-backdrop"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir="rtl"
        data-testid="game-how-to-play-dialog"
        data-game-id={guide.gameId}
        className={cn(
          'relative flex max-h-[min(88dvh,40rem)] w-full max-w-lg flex-col',
          'rounded-t-2xl border border-[color:var(--wanas-game-panel-border,var(--wanas-border))]',
          'bg-[color:var(--wanas-game-panel-bg,var(--wanas-surface))]',
          'shadow-[var(--wanas-game-shadow,var(--wanas-shadow-panel))]',
          'sm:rounded-[var(--wanas-radius-panel)]',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--wanas-game-panel-border,var(--wanas-border))] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[color:var(--wanas-game-text-secondary,var(--wanas-text-secondary))]">
              {HOW_TO_PLAY_BUTTON_LABEL}
            </p>
            <h2
              id={titleId}
              className="mt-0.5 text-lg font-bold leading-7 text-[color:var(--wanas-game-text-primary,var(--wanas-text-primary))]"
            >
              {guide.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={cn(
              'inline-flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg',
              'text-[color:var(--wanas-game-text-secondary,var(--wanas-text-secondary))]',
              'hover:bg-[color:var(--wanas-game-card,var(--wanas-surface-soft))]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45',
            )}
            aria-label="إغلاق"
            data-testid="game-how-to-play-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-5">
            {guide.sections.map((entry) => (
              <section key={entry.id} data-section={entry.id}>
                <h3 className="text-sm font-bold text-[color:var(--wanas-game-text-primary,var(--wanas-text-primary))]">
                  {entry.title}
                </h3>
                {entry.lines.length === 1 ? (
                  <p className="mt-2 text-sm leading-7 text-[color:var(--wanas-game-text-secondary,var(--wanas-text-secondary))]">
                    {entry.lines[0]}
                  </p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1.5 ps-5 text-sm leading-7 text-[color:var(--wanas-game-text-secondary,var(--wanas-text-secondary))]">
                    {entry.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
