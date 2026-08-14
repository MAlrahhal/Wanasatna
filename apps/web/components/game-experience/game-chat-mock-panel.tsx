'use client';

/**
 * In-game chat panel — UI placeholder only.
 * @internal DEV_MOCK — no Socket.IO wiring; send is intentionally unavailable.
 */
import { cn } from '@/lib/utils';

type GameChatMockPanelProps = {
  className?: string;
};

export function GameChatMockPanel({ className }: GameChatMockPanelProps) {
  return (
    <aside
      aria-label="الدردشة"
      className={cn('wanas-game-panel flex min-h-0 flex-col p-3 sm:p-4', className)}
    >
      <h2 className="text-xs font-semibold leading-5 text-[color:var(--wanas-game-text-secondary)]">
        الدردشة
      </h2>
      <p
        className="mt-3 rounded-lg border border-dashed border-[color:var(--wanas-game-panel-border)] bg-[color:var(--wanas-game-card)] px-3 py-4 text-center text-xs leading-5 text-[color:var(--wanas-game-text-secondary)]"
        data-testid="gc-chat-unavailable"
      >
        الدردشة غير متاحة حالياً. قادم لاحقاً.
      </p>
    </aside>
  );
}
