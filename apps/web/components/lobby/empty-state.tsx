import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description?: string;
  className?: string;
  compact?: boolean;
};

export function EmptyState({ title, description, className, compact = false }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-wanas-border bg-wanas-surface-soft text-center',
        compact ? 'px-4 py-5' : 'px-6 py-10',
        className,
      )}
    >
      <h3 className="text-sm font-bold text-wanas-text-primary">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-xs text-sm leading-6 text-wanas-text-muted">{description}</p>
      ) : null}
    </div>
  );
}
