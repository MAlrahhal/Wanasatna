'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { buildLobbyUrl } from '@/lib/room/session';
import { isRoomRoute } from '@/lib/room/navigation-guard';
import { readPersistedActiveRoomSession } from '@/lib/room-v2';
import { cn } from '@/lib/utils';

function useActiveRoomCode() {
  const pathname = usePathname();
  const [roomCode, setRoomCode] = useState<string | null>(null);

  useEffect(() => {
    const session = readPersistedActiveRoomSession();
    setRoomCode(session?.roomCode ?? null);
  }, [pathname]);

  return roomCode;
}

const resumeLinkClassName = cn(
  'inline-flex h-9 min-h-9 items-center justify-center rounded-[var(--wanas-radius-control)] border border-wanas-accent bg-wanas-accent px-4 text-xs font-semibold text-white',
  'hover:border-wanas-accent-hover hover:bg-wanas-accent-hover',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45 focus-visible:ring-offset-2',
);

export function ActiveRoomBanner() {
  const pathname = usePathname();
  const roomCode = useActiveRoomCode();

  if (!roomCode || isRoomRoute(pathname)) {
    return null;
  }

  return (
    <div role="status" className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2.5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-wanas-text-secondary">
          لديك غرفة نشطة
          <span dir="ltr" className="ms-2 font-mono font-bold tracking-[0.18em] text-wanas-text-primary">
            {roomCode}
          </span>
        </p>
        <Link href={buildLobbyUrl(roomCode)} className={resumeLinkClassName}>
          العودة إلى الغرفة
        </Link>
      </div>
    </div>
  );
}

export function HomeActiveRoomResume() {
  const roomCode = useActiveRoomCode();

  if (!roomCode) {
    return null;
  }

  return (
    <aside
      role="status"
      className="wanas-panel flex flex-col gap-3 border-t-2 border-t-wanas-accent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-wanas-text-primary">لديك غرفة نشطة</p>
        <p className="mt-1 text-xs text-wanas-text-muted">
          رمز الغرفة{' '}
          <span dir="ltr" className="font-mono text-sm font-bold tracking-[0.18em] text-wanas-text-primary">
            {roomCode}
          </span>
        </p>
      </div>
      <Link href={buildLobbyUrl(roomCode)} className={cn(resumeLinkClassName, 'h-11 min-h-11 px-5 text-sm')}>
        العودة إلى الغرفة
      </Link>
    </aside>
  );
}
