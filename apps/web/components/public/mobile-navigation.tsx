'use client';

import { GuardedPublicLink } from '@/components/public/guarded-public-link';
import { getHomeRoomActionsHref } from '@/lib/public/scroll-to-room-actions';
import { PUBLIC_NAV_LINKS, PUBLIC_ROUTES } from '@/lib/public/routes';
import { cn } from '@/lib/utils';

type MobileNavigationProps = {
  id: string;
  open: boolean;
  pathname: string;
  isHome: boolean;
  hideCreateRoom: boolean;
  onCreateRoomOnHome: () => void;
  onClose: () => void;
};

export function MobileNavigation({
  id,
  open,
  pathname,
  isHome,
  hideCreateRoom,
  onCreateRoomOnHome,
  onClose,
}: MobileNavigationProps) {
  return (
    <div
      id={id}
      hidden={!open}
      className={cn('border-t border-white/10 bg-wanas-navbar lg:hidden', open ? 'block' : 'hidden')}
    >
      <nav aria-label="التنقل للجوال" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
        {PUBLIC_NAV_LINKS.map((link) => (
          <GuardedPublicLink
            key={link.href}
            href={link.href}
            onNavigate={onClose}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold',
              pathname === link.href
                ? 'border-s-2 border-wanas-accent bg-wanas-surface text-wanas-accent'
                : 'border-s-2 border-transparent text-white/85 hover:bg-wanas-surface hover:text-white',
            )}
          >
            {'premium' in link && link.premium ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-wanas-premium-surface text-wanas-premium-dark">
                ★
              </span>
            ) : null}
            {link.label}
          </GuardedPublicLink>
        ))}
        <div className="mt-2 grid gap-2 border-t border-white/10 pt-4">
          <GuardedPublicLink
            href={PUBLIC_ROUTES.login}
            onNavigate={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-sm font-semibold text-white"
          >
            تسجيل الدخول
          </GuardedPublicLink>
          {!hideCreateRoom ? (
            isHome ? (
              <button
                type="button"
                onClick={onCreateRoomOnHome}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-wanas-accent text-sm font-semibold text-[color:var(--wanas-background)] hover:bg-wanas-accent-hover"
              >
                إنشاء غرفة
              </button>
            ) : (
              <GuardedPublicLink
                href={getHomeRoomActionsHref()}
                onNavigate={onClose}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-wanas-accent text-sm font-semibold text-[color:var(--wanas-background)] hover:bg-wanas-accent-hover"
              >
                إنشاء غرفة
              </GuardedPublicLink>
            )
          ) : null}
        </div>
      </nav>
    </div>
  );
}
