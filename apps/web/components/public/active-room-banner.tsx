'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { buildLobbyUrl, readRoomSession } from '@/lib/room/session';
import { isRoomRoute } from '@/lib/room/navigation-guard';
import { cn } from '@/lib/utils';

export function ActiveRoomBanner() {
  const pathname = usePathname();
  const [roomCode, setRoomCode] = useState<string | null>(null);

  useEffect(() => {
    const session = readRoomSession();
    setRoomCode(session?.roomCode ?? null);
  }, [pathname]);

  if (!roomCode || isRoomRoute(pathname)) {
    return null;
  }

  return (
    <div
      role="status"
      className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-wanas-text-secondary">لديك غرفة نشطة</p>
        <Link
          href={buildLobbyUrl(roomCode)}
          className={cn(
            'inline-flex h-9 items-center justify-center rounded-full bg-wanas-accent px-4 text-xs font-semibold text-[color:var(--wanas-background)]',
            'hover:bg-wanas-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/40 focus-visible:ring-offset-2',
          )}
        >
          العودة للغرفة
        </Link>
      </div>
    </div>
  );
}
