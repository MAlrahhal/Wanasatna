'use client';

import { Suspense } from 'react';
import { RoomProvider } from '@/contexts/room-context';
import { LobbyScreen } from '@/components/lobby/lobby-screen';

function LobbyFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">جاري تحميل الغرفة...</p>
    </div>
  );
}

export function LobbyPageClient() {
  return (
    <Suspense fallback={<LobbyFallback />}>
      <RoomProvider>
        <LobbyScreen />
      </RoomProvider>
    </Suspense>
  );
}
