import Link from 'next/link';
import { SystemStatus } from '@/components/ui/system-status';

type LobbyErrorBannerProps = {
  message: string;
  showHomeAction?: boolean;
};

export function LobbyErrorBanner({ message, showHomeAction = false }: LobbyErrorBannerProps) {
  return (
    <SystemStatus
      tone="error"
      title="تعذر إكمال العملية"
      description={message}
      action={
        showHomeAction ? (
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-[var(--wanas-radius-control)] border border-wanas-border px-3 text-xs font-semibold text-wanas-text-primary hover:border-wanas-accent hover:bg-wanas-surface-soft"
          >
            العودة للرئيسية
          </Link>
        ) : undefined
      }
    />
  );
}
