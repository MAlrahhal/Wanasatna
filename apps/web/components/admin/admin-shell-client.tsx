'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PublicUser } from '@wanasatna/shared';
import { useAuth } from '@/contexts/auth-context';
import { fetchAdminMe } from '@/lib/admin/api';
import { ADMIN_COPY } from '@/lib/admin/copy';
import { ADMIN_NAV_ITEMS, ADMIN_ROUTES } from '@/lib/admin/routes';
import { cn } from '@/lib/utils';

function isNavActive(id: string, pathname: string): boolean {
  if (id === 'rooms') {
    return pathname === ADMIN_ROUTES.rooms || pathname.startsWith(`${ADMIN_ROUTES.rooms}/`);
  }
  if (id === 'roomHistory') {
    return (
      pathname === ADMIN_ROUTES.roomHistory || pathname.startsWith(`${ADMIN_ROUTES.roomHistory}/`)
    );
  }
  if (id === 'users') {
    return pathname === ADMIN_ROUTES.users || pathname.startsWith(`${ADMIN_ROUTES.users}/`);
  }
  if (id === 'games') {
    return pathname === ADMIN_ROUTES.games;
  }
  if (id === 'log') {
    return pathname === ADMIN_ROUTES.history || pathname.startsWith(`${ADMIN_ROUTES.history}/`);
  }
  if (id === 'system') {
    return pathname === ADMIN_ROUTES.system;
  }
  if (id === 'analytics') {
    return pathname === ADMIN_ROUTES.analytics;
  }
  if (id === 'home') {
    return pathname === ADMIN_ROUTES.root;
  }
  return false;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, logout } = useAuth();
  const [gate, setGate] = useState<'loading' | 'unauthenticated' | 'forbidden' | 'ok'>('loading');
  const [adminUser, setAdminUser] = useState<PublicUser | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    let cancelled = false;

    void fetchAdminMe().then((result) => {
      if (cancelled) {
        return;
      }

      if (result.ok) {
        setAdminUser(result.user);
        setGate('ok');
        return;
      }

      setAdminUser(null);
      setGate(result.status === 403 ? 'forbidden' : 'unauthenticated');
    });

    return () => {
      cancelled = true;
    };
  }, [status, user?.id, user?.role]);

  useEffect(() => {
    if (gate === 'unauthenticated') {
      router.replace(ADMIN_ROUTES.login);
    }
  }, [gate, router]);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
        mobileNavToggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  async function handleLogout() {
    await logout();
    router.replace(ADMIN_ROUTES.login);
  }

  if (status === 'loading' || gate === 'loading' || gate === 'unauthenticated') {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-10 outline-none"
      >
        <p className="text-wanas-text-muted text-sm">{ADMIN_COPY.resolving}</p>
      </main>
    );
  }

  if (gate === 'forbidden') {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 outline-none"
      >
        <p role="alert" className="text-wanas-error text-center text-sm font-semibold">
          {ADMIN_COPY.accessDenied}
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <header className="border-wanas-border bg-wanas-surface flex items-center justify-between border-b px-4 py-3 md:hidden">
        <p className="text-wanas-text-primary text-sm font-bold">{ADMIN_COPY.panelTitle}</p>
        <button
          ref={mobileNavToggleRef}
          type="button"
          className="border-wanas-border text-wanas-text-primary rounded-xl border px-3 py-2 text-sm font-semibold"
          aria-expanded={mobileNavOpen}
          aria-controls="admin-mobile-nav"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? ADMIN_COPY.closeNav : ADMIN_COPY.openNav}
        </button>
      </header>

      <aside
        id="admin-mobile-nav"
        className={cn(
          'border-wanas-border bg-wanas-surface md:flex md:w-64 md:shrink-0 md:flex-col md:border-e',
          mobileNavOpen ? 'block border-b' : 'hidden md:flex',
        )}
      >
        <div className="border-wanas-border hidden border-b px-4 py-5 md:block">
          <p className="text-wanas-text-primary text-base font-bold">{ADMIN_COPY.panelTitle}</p>
          {adminUser ? (
            <p className="text-wanas-text-muted mt-2 text-xs">{adminUser.preferredDisplayName}</p>
          ) : null}
        </div>
        <nav aria-label={ADMIN_COPY.navLabel} className="flex flex-col gap-1 p-3">
          {ADMIN_NAV_ITEMS.map((item) =>
            item.placeholder ? (
              <span
                key={item.id}
                className="text-wanas-text-muted rounded-xl px-3 py-2 text-sm font-semibold"
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isNavActive(item.id, pathname) ? 'page' : undefined}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-semibold',
                  isNavActive(item.id, pathname)
                    ? 'bg-wanas-surface-soft text-wanas-text-primary'
                    : 'text-wanas-text-primary hover:bg-wanas-surface-soft',
                )}
                onClick={() => setMobileNavOpen(false)}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="mt-auto p-3">
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
            className="border-wanas-border text-wanas-text-primary hover:bg-wanas-surface-soft inline-flex h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold"
          >
            {ADMIN_COPY.logout}
          </button>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-8 outline-none sm:px-8">
        {children}
      </main>
    </div>
  );
}
