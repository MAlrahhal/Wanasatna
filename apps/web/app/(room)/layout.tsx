'use client';

import { Suspense, type ReactNode } from 'react';
import { RoomProvider } from '@/contexts/room-context';

function RoomRouteFallback() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">جاري تجهيز الغرفة...</p>
    </div>
  );
}

export default function RoomLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RoomRouteFallback />}>
      <RoomProvider>{children}</RoomProvider>
    </Suspense>
  );
}
