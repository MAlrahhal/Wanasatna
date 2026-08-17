'use client';

import { cn } from '@/lib/utils';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';
import { RoomChatPanel } from '@/components/room/room-chat-panel';
import { LobbyPanel } from './lobby-ui';

type LobbyChatProps = {
  className?: string;
};

export function LobbyChat({ className }: LobbyChatProps) {
  return (
    <LobbyPanel
      title={SYSTEM_COPY.chatTitle}
      className={cn('flex h-full min-h-[280px] flex-col', className)}
      bodyClassName="flex min-h-0 flex-1 flex-col p-3"
    >
      <RoomChatPanel />
    </LobbyPanel>
  );
}
