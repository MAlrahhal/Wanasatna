'use client';

import { cn } from '@/lib/utils';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { RoomChatPanel } from '@/components/room/room-chat-panel';

type GameChatMockPanelProps = {
  className?: string;
};

export function GameChatMockPanel({ className }: GameChatMockPanelProps) {
  return (
    <aside
      aria-label={SYSTEM_COPY.chatTitle}
      data-testid="gc-chat-panel"
      className={cn('wanas-game-panel flex min-h-0 flex-col p-3 sm:p-4', className)}
    >
      <h2 className="text-xs font-semibold leading-5 text-[color:var(--wanas-game-text-secondary)]">
        {SYSTEM_COPY.chatTitle}
      </h2>
      <RoomChatPanel variant="game" className="mt-3" />
    </aside>
  );
}
