import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'host'
  | 'premium'
  | 'online'
  | 'offline'
  | 'coming-soon'
  | 'selected'
  | 'role-in'
  | 'role-out'
  | 'impostor'
  | 'first-place';

type BadgeProps = {
  variant: BadgeVariant;
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  host: 'bg-wanas-warning-surface text-wanas-warning-dark border-wanas-warning-border',
  premium: 'bg-wanas-warning-surface text-wanas-warning-dark border-wanas-warning-border-strong',
  online: 'bg-wanas-success-surface text-wanas-success-dark border-wanas-success-border',
  offline: 'bg-wanas-surface-muted text-wanas-text-muted border-wanas-disabled',
  'coming-soon': 'bg-wanas-surface-muted text-wanas-text-muted border-wanas-disabled',
  selected: 'bg-wanas-accent text-white border-wanas-accent',
  'role-in': 'bg-wanas-primary-surface text-wanas-primary-dark border-wanas-premium-border',
  'role-out': 'bg-wanas-accent-soft text-wanas-accent-hover border-wanas-premium-border',
  impostor: 'bg-wanas-accent-soft text-wanas-accent-hover border-wanas-premium-border',
  'first-place': 'bg-wanas-warning-surface text-wanas-warning-dark border-wanas-warning-border-strong',
};

const labels: Record<BadgeVariant, string> = {
  host: '★ المضيف',
  premium: 'بريميوم',
  online: 'متصل',
  offline: 'غير متصل',
  'coming-soon': 'قريباً',
  selected: '✓ مختارة',
  'role-in': 'أنت داخل السالفة',
  'role-out': 'أنت برا السالفة',
  impostor: 'برا السالفة',
  'first-place': '★ الأول',
};

export function Badge({ variant, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors duration-200',
        variantClasses[variant],
        className,
      )}
    >
      {variant === 'online' ? <span className="size-1.5 rounded-full bg-wanas-success" aria-hidden /> : null}
      {variant === 'offline' ? <span className="size-1.5 rounded-full bg-wanas-text-subtle" aria-hidden /> : null}
      {labels[variant]}
    </span>
  );
}
