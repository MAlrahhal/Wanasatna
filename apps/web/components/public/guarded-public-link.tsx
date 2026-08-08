'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useOptionalRoomNavigationGuard } from '@/contexts/room-navigation-guard-context';
import { shouldGuardNavigation } from '@/lib/room/navigation-guard';

type GuardedPublicLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  ariaCurrent?: 'page' | undefined;
};

export function GuardedPublicLink({
  href,
  className,
  children,
  onNavigate,
  ariaCurrent,
}: GuardedPublicLinkProps) {
  const guard = useOptionalRoomNavigationGuard();
  const hasActiveSession = guard?.hasActiveRoomSession ?? false;

  if (guard && shouldGuardNavigation(hasActiveSession, href)) {
    return (
      <button
        type="button"
        aria-current={ariaCurrent}
        onClick={() => {
          onNavigate?.();
          guard.requestNavigation(href);
        }}
        className={cn(className, 'cursor-pointer')}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href={href} onClick={onNavigate} aria-current={ariaCurrent} className={className}>
      {children}
    </Link>
  );
}

export function useGuardedPublicNavigation() {
  const guard = useOptionalRoomNavigationGuard();

  return {
    hasActiveRoomSession: guard?.hasActiveRoomSession ?? false,
    navigate: (href: string, onBeforeNavigate?: () => void) => {
      onBeforeNavigate?.();
      if (guard) {
        guard.requestNavigation(href);
        return;
      }

      window.location.assign(href);
    },
  };
}
