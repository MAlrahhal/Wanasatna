'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { ActiveRoomBanner } from '@/components/public/active-room-banner';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicNavbar } from '@/components/public/public-navbar';
import { RoomNavigationGuardProvider } from '@/contexts/room-navigation-guard-context';

function isInviteCode(value: string | null): boolean {
  return /^\d{6}$/.test((value ?? '').replace(/\D/g, ''));
}

export function PublicLayoutClient({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const inviteEntry = isInviteCode(searchParams.get('code'));

  return (
    <RoomNavigationGuardProvider>
      <div className="flex min-h-full flex-col text-wanas-text-primary">
        <PublicNavbar />
        <ActiveRoomBanner />
        <div className="flex-1">{children}</div>
        {inviteEntry ? null : <PublicFooter />}
      </div>
    </RoomNavigationGuardProvider>
  );
}
