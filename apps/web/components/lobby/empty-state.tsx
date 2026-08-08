import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description?: string;
  className?: string;
};

export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[20px] border border-dashed border-wanas-border bg-wanas-surface-soft px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-wanas-primary-surface text-wanas-primary-dark">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <h3 className="text-sm font-bold text-wanas-text-primary">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-xs text-sm leading-6 text-wanas-text-muted">{description}</p>
      ) : null}
    </div>
  );
}
