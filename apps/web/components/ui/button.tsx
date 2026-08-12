import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-wanas-accent bg-wanas-accent text-white shadow-[0_4px_0_var(--wanas-brand-navy)] hover:-translate-y-0.5 hover:border-wanas-accent-hover hover:bg-wanas-accent-hover hover:shadow-[0_5px_0_var(--wanas-brand-navy)] active:translate-y-1 active:shadow-none focus-visible:ring-wanas-accent/45',
  secondary:
    'border border-wanas-primary-dark bg-transparent text-wanas-text-primary shadow-[var(--wanas-shadow-panel)] hover:-translate-y-0.5 hover:border-wanas-primary-soft hover:bg-wanas-surface-soft active:translate-y-0 active:shadow-none focus-visible:ring-wanas-accent/35',
  ghost:
    'text-wanas-text-secondary hover:bg-wanas-surface-soft hover:text-wanas-text-primary active:translate-y-0.5 focus-visible:ring-wanas-accent/30',
  outline:
    'border border-wanas-border bg-transparent text-wanas-text-primary hover:border-wanas-accent hover:bg-wanas-surface-soft active:translate-y-0.5 focus-visible:ring-wanas-accent/30',
  danger:
    'border border-wanas-error-border bg-wanas-error-surface text-wanas-error hover:bg-wanas-error-surface-strong active:scale-[0.98] focus-visible:ring-wanas-error/35',
  success:
    'border border-wanas-success-border bg-wanas-success-surface text-wanas-success-dark hover:bg-wanas-success-border-light active:scale-[0.98] focus-visible:ring-wanas-success/35',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-10 min-h-10 rounded-[var(--wanas-radius-control)] px-3.5 text-xs',
  md: 'h-11 min-h-11 rounded-[var(--wanas-radius-control)] px-4 text-sm',
  lg: 'h-13 min-h-13 rounded-[var(--wanas-radius-control)] px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-40 disabled:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={size === 'lg' ? 'md' : 'sm'} className="border-white/30 border-t-white" /> : null}
      {children}
    </button>
  );
}
