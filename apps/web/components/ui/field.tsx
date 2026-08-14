import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  icon?: ReactNode;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  type?: 'text' | 'email' | 'password';
  dir?: 'rtl' | 'ltr';
  className?: string;
  inputClassName?: string;
};

/** Shared dark-theme product field. Cyan focus. Not for game-specific guess inputs. */
export function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  helpText,
  icon,
  inputMode = 'text',
  type = 'text',
  dir = 'rtl',
  className,
  inputClassName,
}: FieldProps) {
  const describedBy = error ? `${id}-error` : helpText ? `${id}-help` : undefined;

  return (
    <label htmlFor={id} className={cn('block space-y-2', className)} dir="rtl">
      <span className="text-sm font-semibold leading-6 text-wanas-text-primary">{label}</span>
      <div className="relative">
        {icon ? (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-wanas-text-muted',
              error && 'text-wanas-error',
            )}
          >
            {icon}
          </span>
        ) : null}
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          dir={dir}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            'h-11 min-h-11 w-full rounded-[var(--wanas-radius-control)] border bg-wanas-surface-soft pe-4 text-sm leading-6 text-wanas-text-primary outline-none transition-colors',
            'placeholder:text-wanas-text-muted',
            icon ? 'ps-11' : 'ps-4',
            error
              ? 'border-wanas-error-border bg-wanas-error-surface focus:border-wanas-error focus:ring-2 focus:ring-wanas-error/25'
              : 'border-wanas-border hover:border-wanas-accent/40 focus:border-wanas-accent focus:bg-wanas-surface focus:ring-2 focus:ring-wanas-accent/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            inputClassName,
          )}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs leading-5 text-wanas-error">
          {error}
        </p>
      ) : helpText ? (
        <p id={`${id}-help`} className="text-xs leading-5 text-wanas-text-muted">
          {helpText}
        </p>
      ) : null}
    </label>
  );
}
