'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { HomeActiveRoomResume } from '@/components/public/active-room-banner';
import { FeatureCard } from '@/components/public/feature-card';
import { GamePreviewCard } from '@/components/public/game-cards';
import { InviteJoinCard } from '@/components/public/invite-join-card';
import { RoomActionCards } from '@/components/public/room-action-cards';
import { SectionHeader } from '@/components/public/section-header';
import { Button } from '@/components/ui/button';
import { SystemStatus } from '@/components/ui/system-status';
import { BRAND_NAME_AR } from '@/lib/public/brand';
import { getFeaturedGames } from '@/lib/public/game-catalog';
import { HOME_ROOM_ACTIONS_ID, PUBLIC_ROUTES } from '@/lib/public/routes';
import { scrollToHomeRoomActions } from '@/lib/public/scroll-to-room-actions';
import { useRoomActions } from '@/lib/public/use-room-actions';
import { presentRoomActionError } from '@/lib/ui/system-copy';
import { cn } from '@/lib/utils';

const primaryCtaClassName = cn(
  'inline-flex h-12 min-h-12 items-center justify-center rounded-[var(--wanas-radius-control)] border border-wanas-accent bg-wanas-accent px-6 text-sm font-semibold text-white',
  'shadow-[0_4px_0_var(--wanas-brand-navy)] hover:-translate-y-0.5 hover:border-wanas-accent-hover hover:bg-wanas-accent-hover hover:shadow-[0_5px_0_var(--wanas-brand-navy)]',
  'active:translate-y-1 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/45 focus-visible:ring-offset-2',
);

const steps = [
  { n: '1', title: 'أنشئ غرفة', desc: 'اختر اسمك وابدأ غرفة جديدة.' },
  { n: '2', title: 'شارك الرمز', desc: 'أرسل الرمز لأصدقائك.' },
  { n: '3', title: 'ابدأوا اللعب', desc: 'اختاروا اللعبة واستمتعوا.' },
] as const;

function scrollToRoomActionsIfHash() {
  if (window.location.hash === `#${HOME_ROOM_ACTIONS_ID}`) {
    requestAnimationFrame(() => scrollToHomeRoomActions());
  }
}

export function HomePageClient() {
  const room = useRoomActions();
  const featuredGames = getFeaturedGames();
  const hasFieldError = Boolean(room.fieldErrors.playerName || room.fieldErrors.joinCode);
  const playerNameError = room.fieldErrors.playerName ? (room.errorMessage ?? undefined) : undefined;
  const joinCodeError = room.fieldErrors.joinCode ? (room.errorMessage ?? undefined) : undefined;

  useEffect(() => {
    scrollToRoomActionsIfHash();
    window.addEventListener('hashchange', scrollToRoomActionsIfHash);
    return () => window.removeEventListener('hashchange', scrollToRoomActionsIfHash);
  }, []);

  if (room.inviteFromLink) {
    return (
      <InviteJoinCard
        playerName={room.playerName}
        joinCode={room.joinCode}
        onPlayerNameChange={room.handlePlayerNameChange}
        onJoinRoom={room.handleJoinRoom}
        isJoining={room.isJoining}
        playerNameError={playerNameError}
        actionError={!hasFieldError ? (room.errorMessage ?? undefined) : undefined}
      />
    );
  }

  return (
    <main className="overflow-x-hidden">
      <section className="relative overflow-hidden border-b border-wanas-border">
        <div aria-hidden className="pointer-events-none absolute start-2 top-8 text-white/15">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <path d="M6 9h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 9V7a4 4 0 1 1 8 0v2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-14 lg:py-16">
          <div className="relative max-w-3xl">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-wanas-text-primary sm:text-5xl lg:text-[3.25rem]">
              مكان واحد تلعب فيه مع أصحابك
            </h1>
            <p className="mt-3 max-w-xl text-base leading-8 text-wanas-text-secondary sm:mt-5">
              أنشئ غرفة، شارك الرمز مع أصحابك، وابدؤوا اللعب خلال ثوانٍ — بدون تسجيل.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={scrollToHomeRoomActions}
                disabled={room.isCreating || room.isJoining}
              >
                ابدأ اللعب
              </Button>
              <Link href={PUBLIC_ROUTES.games} className={primaryCtaClassName}>
                استعراض الألعاب
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:gap-10 sm:px-6 sm:py-12 lg:gap-12">
        <HomeActiveRoomResume />

        {room.errorMessage && !hasFieldError && !room.isCreating && !room.isJoining ? (
          <SystemStatus tone="error" {...presentRoomActionError(room.errorMessage)} />
        ) : null}

        <RoomActionCards
          playerName={room.playerName}
          joinCode={room.joinCode}
          onPlayerNameChange={room.handlePlayerNameChange}
          onJoinCodeChange={room.handleJoinCodeChange}
          onCreateRoom={room.handleCreateRoom}
          onJoinRoom={room.handleJoinRoom}
          isCreating={room.isCreating}
          isJoining={room.isJoining}
          playerNameError={playerNameError}
          joinCodeError={joinCodeError}
        />

        <section>
          <div className="mb-5 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader
              title="ألعاب مميزة"
              description="جرّب أبرز الألعاب المتاحة الآن — المزيد في صفحة الألعاب."
            />
            <Link
              href={PUBLIC_ROUTES.games}
              className="inline-flex h-11 items-center justify-center rounded-[var(--wanas-radius-control)] border border-wanas-border bg-wanas-surface px-5 text-sm font-bold text-wanas-text-primary transition-colors hover:border-wanas-accent hover:bg-wanas-surface-soft"
            >
              عرض كل الألعاب
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featuredGames.map((game) => (
              <GamePreviewCard key={game.id} game={game} />
            ))}
          </div>
        </section>

        <section className="wanas-section-frame -mx-4 px-4 py-5 sm:-mx-6 sm:px-6 sm:py-8">
          <SectionHeader
            title="ابدأ الوناسة بثلاث خطوات"
            description="من الغرفة إلى اللعب — بخطوات بسيطة."
            align="center"
            className="mb-5 sm:mb-8"
          />
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.n}>
                <FeatureCard
                  accent="blue"
                  title={step.title}
                  description={step.desc}
                  icon={<span className="text-lg font-bold">{step.n}</span>}
                />
              </li>
            ))}
          </ol>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Link
            href={PUBLIC_ROUTES.games}
            className="wanas-interactive-card group border-t-2 border-t-wanas-brand-navy p-5"
          >
            <h3 className="text-xl font-bold text-wanas-text-primary">استكشف كل الألعاب</h3>
            <p className="mt-2 text-sm leading-7 text-wanas-text-muted">
              تصفّح المكتبة الكاملة مع حالة التوفر وعدد اللاعبين.
            </p>
            <span className="mt-4 inline-flex text-sm font-bold text-wanas-primary-dark group-hover:underline">
              الانتقال إلى الألعاب
            </span>
          </Link>
          <div className="wanas-panel p-5">
            <p className="text-[11px] font-semibold text-wanas-text-muted">قريباً — غير متاح حالياً</p>
            <h3 className="mt-2 text-xl font-bold text-wanas-text-primary">{BRAND_NAME_AR} بريميوم</h3>
            <p className="mt-2 text-sm leading-7 text-wanas-text-muted">
              مزايا إضافية اختيارية — اللعب الأساسي يبقى بدون حساب.
            </p>
            <Link
              href={PUBLIC_ROUTES.premium}
              className="mt-4 inline-flex text-sm font-medium text-wanas-text-muted hover:text-wanas-text-secondary hover:underline"
            >
              تعرّف على بريميوم
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
