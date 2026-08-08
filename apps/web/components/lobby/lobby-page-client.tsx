'use client';

import { Suspense } from 'react';
import { RoomProvider } from '@/contexts/room-context';
import { RoomNavigationGuardProvider } from '@/contexts/room-navigation-guard-context';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicNavbar } from '@/components/public/public-navbar';
import { LobbyScreen } from '@/components/lobby/lobby-screen';
import { LobbyStateCard } from '@/components/lobby/lobby-ui';

function LobbyFallback() {
  return (
    <LobbyStateCard
      title="جاري تجهيز الغرفة..."
      description="يتم تحميل بيانات الغرفة."
      icon={
        <span className="size-8 animate-spin rounded-full border-[3px] border-wanas-primary-muted border-t-wanas-primary" />
      }
    />
  );
}

export function LobbyPageClient() {
  return (
    <Suspense fallback={<LobbyFallback />}>
      <RoomProvider>
        <RoomNavigationGuardProvider>
          <PublicNavbar />
          <LobbyScreen />
          <PublicFooter />
        </RoomNavigationGuardProvider>
      </RoomProvider>
    </Suspense>
  );
}
