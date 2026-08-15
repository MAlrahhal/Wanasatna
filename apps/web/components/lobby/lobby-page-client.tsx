'use client';

import { RoomNavigationGuardProvider } from '@/contexts/room-navigation-guard-context';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicNavbar } from '@/components/public/public-navbar';
import { LobbyScreen } from '@/components/lobby/lobby-screen';

export function LobbyPageClient() {
  return (
    <RoomNavigationGuardProvider>
      <div className="hidden xl:block">
        <PublicNavbar />
      </div>
      <LobbyScreen />
      <div className="hidden xl:block">
        <PublicFooter />
      </div>
    </RoomNavigationGuardProvider>
  );
}
