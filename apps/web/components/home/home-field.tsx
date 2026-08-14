import type { ReactNode } from 'react';
import { Field } from '@/components/ui/field';

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
    <Field
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      icon={icon}
      disabled={disabled}
      error={hasError ? 'تحقق من هذا الحقل.' : undefined}
      inputMode={inputMode}
      dir={inputMode === 'numeric' ? 'ltr' : 'rtl'}
      className={className}
      inputClassName={inputClassName}
    />
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
