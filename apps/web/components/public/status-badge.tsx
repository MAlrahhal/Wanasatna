import { cn } from '@/lib/utils';

type StatusBadgeProps = {
  variant: 'available' | 'coming-soon';
  className?: string;
};

const variants = {
  available: 'bg-wanas-success-surface text-wanas-success-dark border-wanas-success-border',
  'coming-soon': 'bg-wanas-surface-muted text-wanas-text-muted border-wanas-disabled',
};

const labels = {
  available: 'متاحة',
  'coming-soon': 'قريباً',
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
