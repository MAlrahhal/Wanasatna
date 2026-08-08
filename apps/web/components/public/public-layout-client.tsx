'use client';

import type { ReactNode } from 'react';
import { ActiveRoomBanner } from '@/components/public/active-room-banner';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicNavbar } from '@/components/public/public-navbar';
import { RoomNavigationGuardProvider } from '@/contexts/room-navigation-guard-context';

export function PublicLayoutClient({ children }: { children: ReactNode }) {
  return (
    <RoomNavigationGuardProvider>
      <div className="flex min-h-full flex-col bg-wanas-background text-wanas-text-primary">
        <PublicNavbar />
        <ActiveRoomBanner />
        <div className="flex-1">{children}</div>
        <PublicFooter />
      </div>
    </RoomNavigationGuardProvider>
  );
}
