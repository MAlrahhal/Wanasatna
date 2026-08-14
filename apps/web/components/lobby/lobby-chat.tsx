'use client';

/**
 * Chat UI placeholder for Sprint 2.5.
 * Replace with socket-backed messages in the Chat sprint.
 */
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { LobbyPanel } from './lobby-ui';

type LobbyChatProps = {
  className?: string;
};

export function LobbyChat({ className }: LobbyChatProps) {
  return (
    <LobbyPanel
      title="دردشة الغرفة"
      description="غير متاحة حالياً."
      className={cn('h-fit', className)}
      bodyClassName="p-3"
    >
      <EmptyState compact title="الدردشة غير متاحة حالياً. قادم لاحقاً." />
    </LobbyPanel>
  );
}
