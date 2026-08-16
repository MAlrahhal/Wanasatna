import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PublicFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: ReactNode;
  disabled?: boolean;
  hasError?: boolean;
  inputMode?: 'text' | 'numeric' | 'email';
  type?: 'text' | 'email' | 'password';
  inputClassName?: string;
  autoComplete?: string;
  name?: string;
};

export function PublicField({
  id,
  label,
  value,
  onChange,
  placeholder,
  icon,
  disabled = false,
  hasError = false,
  inputMode = 'text',
  type = 'text',
  inputClassName,
  autoComplete,
  name,
}: PublicFieldProps) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm font-semibold text-wanas-text-primary">{label}</span>
      <div className="relative">
        {icon ? (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-wanas-text-muted',
              hasError && 'text-wanas-error',
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
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          name={name}
          aria-invalid={hasError}
          className={cn(
            'h-12 w-full rounded-2xl border bg-wanas-surface-soft pe-4 text-sm text-wanas-text-primary outline-none transition-all',
            icon ? 'ps-11' : 'px-4',
            hasError
              ? 'border-wanas-error-border bg-wanas-error-surface focus:border-wanas-error focus:ring-2 focus:ring-wanas-error/20'
              : 'border-wanas-border hover:border-wanas-accent-soft focus:border-wanas-accent focus:bg-wanas-surface focus:ring-2 focus:ring-wanas-accent/20',
            'disabled:cursor-not-allowed disabled:opacity-60',
            inputClassName,
          )}
        />
      </div>
    </label>
  );
}

export function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="8" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8V6a4 4 0 1 1 8 0v2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m3 7 9 6 9-6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
