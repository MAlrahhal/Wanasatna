'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { isRoomRoute } from '@/lib/room/navigation-guard';
import {
  getRoomSessionManager,
  isTerminalResumeFailure,
  notifyResumeDiscovery,
  type ActiveRoomSession,
} from '@/lib/room-v2';
import {
  getResumeDiscoverySnapshot,
  subscribeResumeDiscovery,
} from '@/lib/room-v2/discover-claim';
import { cn } from '@/lib/utils';

export function useDiscoverableReconnectClaim(roomCode?: string | null) {
  return useSyncExternalStore(
    subscribeResumeDiscovery,
    () => getResumeDiscoverySnapshot(roomCode ?? null),
    () => null,
  );
}

async function resumeClaimAndOpenLobby(
  claim: ActiveRoomSession,
  router: { push: (href: string) => void },
): Promise<{ ok: true } | { ok: false; message: string; hide: boolean }> {
  const manager = getRoomSessionManager();
  manager.clearExplicitLeaveHome();
  const result = await manager.enterFromJoinForm(claim.roomCode, claim.playerName);

  if (!result.success) {
    notifyResumeDiscovery();
    return {
      ok: false,
      message: result.error.message,
      hide: isTerminalResumeFailure(result.error.code),
    };
  }

  notifyResumeDiscovery();
  const lobbyUrl = `/lobby?code=${encodeURIComponent(result.data.roomCode)}`;
  if (manager.hasExplicitlyLeftRoomThisRuntime()) {
    window.location.assign(lobbyUrl);
    return { ok: true };
  }

  window.history.replaceState(window.history.state, '', lobbyUrl);
  router.push(lobbyUrl);
  return { ok: true };
}

const resumeButtonClassName = cn(
  'inline-flex h-9 min-h-9 items-center justify-center rounded-[var(--wanas-radius-control)] border border-wanas-accent bg-wanas-accent px-4 text-xs font-semibold text-white',
  'hover:border-wanas-accent-hover hover:bg-wanas-accent-hover',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45 focus-visible:ring-offset-2',
  'disabled:pointer-events-none disabled:opacity-60',
);

export function RoomResumePanel({
  claim,
  compact = false,
  busy = false,
  onResume,
}: {
  claim: ActiveRoomSession;
  compact?: boolean;
  busy?: boolean;
  onResume: () => void;
}) {
  const name = claim.playerName.trim();

  if (compact) {
    return (
      <div role="status" className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2.5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-wanas-text-secondary">
            لديك غرفة مفتوحة
            <span dir="ltr" className="ms-2 font-mono font-bold tracking-[0.18em] text-wanas-text-primary">
              {claim.roomCode}
            </span>
            <span className="ms-2 text-wanas-text-muted">باسم {name}</span>
          </p>
          <button type="button" className={resumeButtonClassName} onClick={onResume} disabled={busy}>
            {busy ? 'جاري العودة…' : `العودة كـ ${name}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <aside
      role="status"
      className="wanas-panel flex flex-col gap-3 border-t-2 border-t-wanas-accent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-wanas-text-primary">لديك غرفة مفتوحة</p>
        <p className="mt-1 text-xs text-wanas-text-muted">
          يمكنك العودة إلى الغرفة{' '}
          <span dir="ltr" className="font-mono text-sm font-bold tracking-[0.18em] text-wanas-text-primary">
            {claim.roomCode}
          </span>{' '}
          باسم {name}
        </p>
      </div>
      <button
        type="button"
        className={cn(resumeButtonClassName, 'h-11 min-h-11 px-5 text-sm')}
        onClick={onResume}
        disabled={busy}
      >
        {busy ? 'جاري العودة…' : `العودة كـ ${name}`}
      </button>
    </aside>
  );
}

export function ActiveRoomBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const claim = useDiscoverableReconnectClaim();
  const [busy, setBusy] = useState(false);

  const onResume = useCallback(() => {
    if (!claim || busy) {
      return;
    }

    setBusy(true);
    void resumeClaimAndOpenLobby(claim, router).then((result) => {
      if (!result.ok) {
        setBusy(false);
      }
    });
  }, [busy, claim, router]);

  if (!claim || isRoomRoute(pathname) || pathname === '/') {
    return null;
  }

  return <RoomResumePanel claim={claim} compact busy={busy} onResume={onResume} />;
}

export function HomeActiveRoomResume({
  claims,
  busy = false,
  onResume,
}: {
  claims: ActiveRoomSession[];
  busy?: boolean;
  onResume: (claim: ActiveRoomSession) => void;
}) {
  if (claims.length === 0) {
    return null;
  }

  if (claims.length === 1) {
    const claim = claims[0]!;
    return <RoomResumePanel claim={claim} busy={busy} onResume={() => onResume(claim)} />;
  }

  return (
    <aside
      role="status"
      className="flex flex-col gap-3"
    >
      <p className="text-sm font-bold text-wanas-text-primary">لديك غرف مفتوحة</p>
      {claims.map((claim) => (
        <RoomResumePanel
          key={`${claim.roomId}:${claim.playerId}`}
          claim={claim}
          busy={busy}
          onResume={() => onResume(claim)}
        />
      ))}
    </aside>
  );
}
