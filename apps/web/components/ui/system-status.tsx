import type { ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type SystemStatusTone = 'loading' | 'connecting' | 'info' | 'error';

type SystemStatusProps = {
  tone?: SystemStatusTone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

const toneClasses: Record<SystemStatusTone, string> = {
  loading: 'border-wanas-border bg-wanas-surface',
  connecting: 'border-wanas-border bg-wanas-surface',
  info: 'border-wanas-border bg-wanas-surface',
  error: 'border-wanas-error-border bg-wanas-error-surface text-wanas-error',
};

export function SystemStatus({
  tone = 'info',
  title,
  description,
  action,
  className,
}: SystemStatusProps) {
  const showSpinner = tone === 'loading' || tone === 'connecting';

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-[var(--wanas-radius-card)] border px-4 py-3 text-sm leading-6',
        toneClasses[tone],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {showSpinner ? <Spinner size="sm" className="mt-0.5 shrink-0" /> : null}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-wanas-text-primary">{title}</p>
          {description ? (
            <p className="mt-1 text-wanas-text-muted">{description}</p>
          ) : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
