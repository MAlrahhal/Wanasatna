'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { HomeActiveRoomResume } from '@/components/public/active-room-banner';
import { FeatureCard } from '@/components/public/feature-card';
import { GamePreviewCard } from '@/components/public/game-cards';
import { InviteJoinCard } from '@/components/public/invite-join-card';
import { RoomActionCards } from '@/components/public/room-action-cards';
import { PublicBrandLogo } from '@/components/public/public-brand-logo';
import { SectionHeader } from '@/components/public/section-header';
import { Button } from '@/components/ui/button';
import { SystemStatus } from '@/components/ui/system-status';
import { getFeaturedGames } from '@/lib/public/game-catalog';
import { HOME_ROOM_ACTIONS_ID, PUBLIC_ROUTES } from '@/lib/public/routes';
import { scrollToHomeRoomActions } from '@/lib/public/scroll-to-room-actions';
import { useRoomActions } from '@/lib/public/use-room-actions';
import { presentRoomActionError } from '@/lib/ui/system-copy';

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
  const playerNameError = room.fieldErrors.playerName
    ? (room.errorMessage ?? undefined)
    : undefined;
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
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14 lg:py-16">
          <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
            <div className="max-w-3xl">
              <h1 className="text-wanas-text-primary text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-[3.25rem]">
                مكان واحد تلعب فيه مع أصحابك
              </h1>
              <p className="text-wanas-text-secondary mt-3 max-w-xl text-base leading-8 sm:mt-5">
                أنشئ غرفة، شارك الرمز، وابدؤوا اللعب خلال ثوانٍ — مباشرة من المتصفح وبدون تسجيل.
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
                <Link
                  href={PUBLIC_ROUTES.games}
                  className="border-wanas-border bg-wanas-surface text-wanas-text-primary hover:border-wanas-accent hover:bg-wanas-surface-soft inline-flex h-12 min-h-12 items-center justify-center rounded-[var(--wanas-radius-control)] border px-6 text-sm font-semibold"
                >
                  استعراض الألعاب
                </Link>
              </div>
            </div>
            <PublicBrandLogo size="lg" className="mx-auto" />
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
              className="border-wanas-border bg-wanas-surface text-wanas-text-primary hover:border-wanas-accent hover:bg-wanas-surface-soft inline-flex h-11 items-center justify-center rounded-[var(--wanas-radius-control)] border px-5 text-sm font-bold transition-colors"
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
      </div>
    </main>
  );
}
