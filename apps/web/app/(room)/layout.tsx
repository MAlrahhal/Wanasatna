'use client';

import { Suspense, type ReactNode } from 'react';
import { RoomProvider } from '@/contexts/room-context';
import { RoomChatProvider } from '@/contexts/room-chat-context';
import { SystemStatus } from '@/components/ui/system-status';
import { GameAudioSession } from '@/components/game/game-audio-session';
import { SYSTEM_COPY } from '@/lib/ui/system-copy';

function RoomRouteFallback() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center p-4 sm:p-6">
      <SystemStatus tone="connecting" title={SYSTEM_COPY.connecting} />
    </div>
  );
}

export default function RoomLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RoomRouteFallback />}>
      <RoomProvider>
        <RoomChatProvider>
          <GameAudioSession />
          {children}
        </RoomChatProvider>
      </RoomProvider>
    </Suspense>
  );
}
