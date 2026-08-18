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
  cancelLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
};

const variantStyles: Record<
  DialogVariant,
  { iconBg: string; iconColor: string; icon: ReactNode }
> = {
  confirmation: {
    iconBg: 'bg-wanas-primary-surface',
    iconColor: 'text-wanas-accent',
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
    iconColor: 'text-wanas-accent',
    icon: <Spinner size="md" />,
  },
};

export function UiDialog({
  open,
  title,
  description,
  variant = 'confirmation',
  confirmLabel = 'حسناً',
  cancelLabel = 'إلغاء',
  onClose,
  onConfirm,
}: UiDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const styles = variantStyles[variant];
  const confirmVariant =
    variant === 'error' || variant === 'warning' ? 'destructive' : variant === 'success' ? 'success' : 'primary';

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
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
        dir="rtl"
        className="relative w-full max-w-md rounded-[var(--wanas-radius-panel)] border border-wanas-border bg-wanas-surface p-6 shadow-[var(--wanas-shadow-panel)]"
      >
        <div className={cn('mb-4 flex size-12 items-center justify-center rounded-2xl', styles.iconBg, styles.iconColor)}>
          {styles.icon}
        </div>
        <h2 id={titleId} className="text-xl font-bold leading-7 text-wanas-text-primary">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-7 text-wanas-text-secondary">
          {description}
        </p>
        {variant === 'loading' ? (
          <p className="mt-6 text-center text-sm text-wanas-text-muted">جاري التحميل…</p>
        ) : (
          <div className="mt-6 flex gap-3">
            {variant === 'confirmation' || variant === 'warning' ? (
              <Button variant="outline" className="flex-1" onClick={onClose}>
                {cancelLabel}
              </Button>
            ) : null}
            <Button
              ref={confirmRef}
              variant={confirmVariant}
              className="flex-1"
              onClick={() => {
                onConfirm?.();
                onClose();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
