import { Suspense } from 'react';
import { RoomProvider } from '@/contexts/room-context';
import { GamePageClient } from './game-page-client';

function GameRouteFallback() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">جاري تحميل shell اللعبة...</p>
    </div>
  );
}

export default function GamePage() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <Suspense fallback={<GameRouteFallback />}>
        <RoomProvider>
          <GamePageClient />
        </RoomProvider>
      </Suspense>
    </main>
  );
}
