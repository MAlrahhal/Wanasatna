'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PublicBrandLogo } from '@/components/public/public-brand-logo';
import { MobileNavigation } from '@/components/public/mobile-navigation';
import { GuardedPublicLink, useGuardedPublicNavigation } from '@/components/public/guarded-public-link';
import { getHomeRoomActionsHref, scrollToHomeRoomActions } from '@/lib/public/scroll-to-room-actions';
import { PUBLIC_NAV_LINKS, PUBLIC_ROUTES } from '@/lib/public/routes';
import { shouldHideCreateRoomAction } from '@/lib/room/navigation-guard';
import { cn } from '@/lib/utils';

const navPlayClassName = cn(
  'inline-flex h-10 items-center justify-center rounded-[var(--wanas-radius-control)] border border-white/25 bg-transparent px-4 text-sm font-semibold text-white/90',
  'hover:border-white/50 hover:bg-white/10 hover:text-white',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-wanas-navbar',
);

export function PublicNavbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hasActiveRoomSession } = useGuardedPublicNavigation();
  const isHome = pathname === PUBLIC_ROUTES.home;
  const hideCreateRoom = shouldHideCreateRoomAction(hasActiveRoomSession);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function handleCreateRoomOnHome() {
    setMobileOpen(false);
    scrollToHomeRoomActions();
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-white/10 bg-wanas-navbar text-wanas-text-on-brand transition-colors duration-200',
        isScrolled && 'shadow-md shadow-wanas-brand-navy/20',
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <GuardedPublicLink
          href={PUBLIC_ROUTES.home}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-wanas-navbar"
        >
          <PublicBrandLogo size="sm" tone="on-dark" />
        </GuardedPublicLink>

        <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <GuardedPublicLink
                key={link.href}
                href={link.href}
                ariaCurrent={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-wanas-navbar',
                  isActive
                    ? 'border-b-2 border-wanas-accent text-white'
                    : 'border-b-2 border-transparent text-white/80 hover:border-wanas-primary-dark hover:text-white',
                  'premium' in link && link.premium && !isActive && 'text-wanas-premium',
                )}
              >
                {'premium' in link && link.premium ? (
                  <span aria-hidden className="flex size-4 items-center justify-center rounded-full bg-wanas-premium-surface text-wanas-premium-dark">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2Z" />
                    </svg>
                  </span>
                ) : null}
                {link.label}
              </GuardedPublicLink>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <GuardedPublicLink
            href={PUBLIC_ROUTES.login}
            className={cn(
              'inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white/85 transition-colors',
              'hover:bg-white/10 hover:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-wanas-navbar',
              pathname === PUBLIC_ROUTES.login && 'bg-white/15 text-white',
            )}
          >
            تسجيل الدخول
          </GuardedPublicLink>
          {!hideCreateRoom ? (
            isHome ? (
              <button type="button" onClick={handleCreateRoomOnHome} className={navPlayClassName}>
                ابدأ اللعب
              </button>
            ) : (
              <GuardedPublicLink href={getHomeRoomActionsHref()} className={navPlayClassName}>
                إنشاء غرفة
              </GuardedPublicLink>
            )
          ) : null}
        </div>

        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="public-mobile-nav"
          aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex size-10 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white lg:hidden"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      <MobileNavigation
        id="public-mobile-nav"
        open={mobileOpen}
        pathname={pathname}
        isHome={isHome}
        hideCreateRoom={hideCreateRoom}
        onCreateRoomOnHome={handleCreateRoomOnHome}
        onClose={() => setMobileOpen(false)}
      />
    </header>
  );
}
