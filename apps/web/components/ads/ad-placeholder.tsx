import { cn } from '@/lib/utils';

type AdPlaceholderProps = {
  placement: string;
  format: 'horizontal' | 'vertical';
  className?: string;
};

const formatClassNames = {
  horizontal: 'min-h-20 sm:min-h-24',
  vertical: 'min-h-28',
} as const;

export function AdPlaceholder({ placement, format, className }: AdPlaceholderProps) {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <aside
      aria-hidden="true"
      data-ad-placement={placement}
      data-ad-format={format}
      className={cn(
        'border-wanas-border bg-wanas-surface-soft/60 text-wanas-text-muted flex w-full items-center justify-center rounded-[var(--wanas-radius-control)] border border-dashed px-4 text-center text-xs font-semibold',
        formatClassNames[format],
        className,
      )}
    >
      <span>مساحة إعلانية</span>
    </aside>
  );
}
