'use client';

import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type DialogVariant = 'confirmation' | 'error' | 'success' | 'warning' | 'loading';

type UiDialogProps = {
  open: boolean;
  title: string;
  description: string;
  variant?: DialogVariant;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
};

const variantStyles: Record<
  DialogVariant,
  { iconBg: string; iconColor: string; icon: ReactNode }
> = {
  confirmation: {
    iconBg: 'bg-wanas-primary-surface',
    iconColor: 'text-wanas-primary-dark',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  error: {
    iconBg: 'bg-wanas-error-surface',
    iconColor: 'text-wanas-error',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15 9 9 15M9 9l6 6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  success: {
    iconBg: 'bg-wanas-success-surface',
    iconColor: 'text-wanas-success-dark',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 12.5 10.5 15 16 9.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  warning: {
    iconBg: 'bg-wanas-warning-surface',
    iconColor: 'text-wanas-warning-dark',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.3 4.5h3.4L20 19H4L10.3 4.5Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  loading: {
    iconBg: 'bg-wanas-panel-soft',
    iconColor: 'text-wanas-primary-dark',
    icon: <Spinner size="md" />,
  },
};

export function UiDialog({
  open,
  title,
  description,
  variant = 'confirmation',
  confirmLabel = 'حسناً',
  onClose,
  onConfirm,
}: UiDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const styles = variantStyles[variant];

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button type="button" aria-label="إغلاق" className="absolute inset-0 bg-wanas-text-primary/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-[20px] border border-wanas-border bg-wanas-surface p-6 shadow-lg"
      >
        <div className={cn('mb-4 flex size-12 items-center justify-center rounded-2xl', styles.iconBg, styles.iconColor)}>
          {styles.icon}
        </div>
        <h2 id={titleId} className="text-xl font-bold text-wanas-text-primary">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-7 text-wanas-text-secondary">
          {description}
        </p>
        {variant === 'loading' ? (
          <p className="mt-6 text-center text-sm text-wanas-text-muted">جاري التحميل…</p>
        ) : (
          <div className="mt-6 flex gap-3">
            {variant === 'confirmation' ? (
              <Button variant="outline" className="flex-1" onClick={onClose}>
                إلغاء
              </Button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              onClick={() => {
                onConfirm?.();
                onClose();
              }}
              className={cn(
                'inline-flex h-11 flex-1 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                variant === 'error' && 'border border-wanas-error-border bg-wanas-error-surface text-wanas-error',
                variant === 'success' &&
                  'border border-wanas-success-border bg-wanas-success-surface text-wanas-success-dark',
                variant !== 'error' &&
                  variant !== 'success' &&
                  'bg-wanas-accent text-white hover:bg-wanas-accent-hover focus-visible:ring-wanas-accent/40',
              )}
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
