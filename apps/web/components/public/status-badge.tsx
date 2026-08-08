import { cn } from '@/lib/utils';

type StatusBadgeProps = {
  variant: 'available' | 'coming-soon' | 'premium';
  className?: string;
};

const variants = {
  available: 'bg-wanas-success-surface text-wanas-success-dark border-wanas-success-border',
  'coming-soon': 'bg-wanas-surface-muted text-wanas-text-muted border-wanas-disabled',
  premium: 'bg-wanas-warning-surface text-wanas-warning-dark border-wanas-warning-border-strong',
};

const labels = {
  available: 'متاحة',
  'coming-soon': 'قريباً',
  premium: 'بريميوم',
};

export function StatusBadge({ variant, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold',
        variants[variant],
        className,
      )}
    >
      {labels[variant]}
    </span>
  );
}
