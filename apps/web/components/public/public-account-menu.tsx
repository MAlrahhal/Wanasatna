'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { GuardedPublicLink } from '@/components/public/guarded-public-link';
import { useOptionalAuth } from '@/contexts/auth-context';
import { AUTH_COPY } from '@/lib/auth/copy';
import { PUBLIC_ROUTES } from '@/lib/public/routes';
import { cn } from '@/lib/utils';

type PublicAccountMenuProps = {
  preferredDisplayName: string;
  onLogout: () => void | Promise<void>;
  variant: 'desktop' | 'mobile';
  onAfterLogout?: () => void;
};

export function PublicAccountMenu({
  preferredDisplayName,
  onLogout,
  variant,
  onAfterLogout,
}: PublicAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await onLogout();
      setOpen(false);
      onAfterLogout?.();
    } finally {
      setLoggingOut(false);
    }
  }

  if (variant === 'mobile') {
    return (
      <div className="grid gap-2">
        <p className="truncate px-1 text-sm font-semibold text-white" title={preferredDisplayName}>
          {preferredDisplayName}
        </p>
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-sm font-semibold text-white disabled:opacity-60"
        >
          {AUTH_COPY.logout}
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex h-10 max-w-[11rem] items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white/90',
          'hover:bg-white/10 hover:text-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-wanas-navbar',
          open && 'bg-white/15 text-white',
        )}
      >
        <span className="truncate">{preferredDisplayName}</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute end-0 z-20 mt-2 min-w-[10rem] rounded-2xl border border-white/15 bg-wanas-navbar p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            className="flex w-full items-center rounded-xl px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10 disabled:opacity-60"
          >
            {AUTH_COPY.logout}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const desktopLoginClassName = cn(
  'inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white/85 transition-colors',
  'hover:bg-white/10 hover:text-white',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-wanas-navbar',
);

const mobileLoginClassName =
  'inline-flex h-11 items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-sm font-semibold text-white';

type PublicAuthNavControlProps = {
  variant: 'desktop' | 'mobile';
  loginActive?: boolean;
  onNavigate?: () => void;
};

export function PublicAuthNavControl({
  variant,
  loginActive = false,
  onNavigate,
}: PublicAuthNavControlProps) {
  const auth = useOptionalAuth();
  const user = auth?.status === 'ready' ? auth.user : null;

  if (user && auth) {
    return (
      <PublicAccountMenu
        preferredDisplayName={user.preferredDisplayName}
        onLogout={auth.logout}
        variant={variant}
        onAfterLogout={onNavigate}
      />
    );
  }

  if (variant === 'mobile') {
    return (
      <GuardedPublicLink
        href={PUBLIC_ROUTES.login}
        onNavigate={onNavigate}
        className={mobileLoginClassName}
      >
        {AUTH_COPY.loginTitle}
      </GuardedPublicLink>
    );
  }

  return (
    <GuardedPublicLink
      href={PUBLIC_ROUTES.login}
      className={cn(desktopLoginClassName, loginActive && 'bg-white/15 text-white')}
    >
      {AUTH_COPY.loginTitle}
    </GuardedPublicLink>
  );
}
