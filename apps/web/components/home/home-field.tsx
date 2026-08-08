import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type HomeFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: ReactNode;
  disabled?: boolean;
  hasError?: boolean;
  inputMode?: 'text' | 'numeric';
  className?: string;
  inputClassName?: string;
};

export function HomeField({
  id,
  label,
  value,
  onChange,
  placeholder,
  icon,
  disabled = false,
  hasError = false,
  inputMode = 'text',
  className,
  inputClassName,
}: HomeFieldProps) {
  return (
    <label htmlFor={id} className={cn('block space-y-2', className)}>
      <span className="text-sm font-medium text-[#0F172A]">{label}</span>
      <div className="relative">
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]',
            hasError && 'text-[#EF4444]',
          )}
        >
          {icon}
        </span>
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={hasError}
          className={cn(
            'h-12 w-full rounded-xl border bg-[#F8FAFC] pe-4 ps-11 text-sm text-[#0F172A] outline-none transition-all duration-200 placeholder:text-[#94A3B8] disabled:cursor-not-allowed disabled:opacity-60',
            hasError
              ? 'border-[#FCA5A5] bg-[#FEF2F2] focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20'
              : 'border-[#E2E8F0] hover:border-[#CBD5E1] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20',
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
