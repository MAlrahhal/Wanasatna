import Link from 'next/link';
import { cn } from '@/lib/utils';

type LobbyErrorBannerProps = {
  message: string;
  showHomeAction?: boolean;
};

export function LobbyErrorBanner({ message, showHomeAction = false }: LobbyErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-2xl border border-wanas-error-border bg-wanas-error-surface px-4 py-3 text-sm text-wanas-error',
        showHomeAction && 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
      )}
    >
      <span>{message}</span>
      {showHomeAction ? (
        <Link
          href="/"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-wanas-error-border bg-wanas-surface px-4 text-sm font-semibold text-wanas-error hover:bg-wanas-error-surface-hover"
        >
          العودة للرئيسية
        </Link>
      ) : null}
    </div>
  );
}
