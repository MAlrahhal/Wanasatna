'use client';

import { useEffect, useRef, useState } from 'react';
import type { GuessingChallengeCardConfirmStatus } from '@wanasatna/shared';
import { Button } from '@/components/ui/button';
import { playSoftCardRequestPing } from '@/lib/game/sounds';
import { cn } from '@/lib/utils';

type CardVariant = 'yellow' | 'red';

const CARD_COPY: Record<
  CardVariant,
  {
    shortName: string;
    title: string;
    explanation: string;
    icon: string;
  }
> = {
  yellow: {
    shortName: 'الصفراء',
    title: 'البطاقة الصفراء',
    explanation: 'تمنح فريقك 3 أسئلة متتالية.',
    icon: '🟨',
  },
  red: {
    shortName: 'الحمراء',
    title: 'البطاقة الحمراء',
    explanation: 'تغيّر هوية الفريق الخصم إلى هوية جديدة من نفس الفئة.',
    icon: '🟥',
  },
};

export type GuessingChallengeSpecialCardsPanelProps = {
  yellowAvailable: boolean;
  redAvailable: boolean;
  canUseYellow: boolean;
  canUseRed: boolean;
  disabled?: boolean;
  cardConfirmStatus: GuessingChallengeCardConfirmStatus | null;
  /** Optional activation toast e.g. تم تفعيل البطاقة الصفراء */
  activationMessage?: string | null;
  onUseYellow: () => void;
  onUseRed: () => void;
  className?: string;
};

export function GuessingChallengeSpecialCardsPanel({
  yellowAvailable,
  redAvailable,
  canUseYellow,
  canUseRed,
  disabled = false,
  cardConfirmStatus,
  activationMessage = null,
  onUseYellow,
  onUseRed,
  className,
}: GuessingChallengeSpecialCardsPanelProps) {
  const [detailCard, setDetailCard] = useState<CardVariant | null>(null);
  const lastPingKey = useRef<string | null>(null);

  // Teammate alert: visual + one sound per fresh request (not self-confirmed).
  const teammateRequest =
    cardConfirmStatus && !cardConfirmStatus.selfConfirmed ? cardConfirmStatus : null;

  useEffect(() => {
    if (!teammateRequest) {
      return;
    }

    const key = `${teammateRequest.card}:${teammateRequest.requestingPlayerId}:${teammateRequest.confirmedCount}`;
    if (lastPingKey.current === key) {
      return;
    }
    lastPingKey.current = key;
    playSoftCardRequestPing();
  }, [teammateRequest]);

  useEffect(() => {
    if (!cardConfirmStatus) {
      lastPingKey.current = null;
    }
  }, [cardConfirmStatus]);

  const detail = detailCard ? CARD_COPY[detailCard] : null;
  const detailAvailable =
    detailCard === 'yellow' ? yellowAvailable : detailCard === 'red' ? redAvailable : false;
  const detailCanUse =
    detailCard === 'yellow' ? canUseYellow : detailCard === 'red' ? canUseRed : false;
  const confirmForDetail =
    detailCard && cardConfirmStatus?.card === detailCard ? cardConfirmStatus : null;

  const waitingSelf =
    cardConfirmStatus?.selfConfirmed === true
      ? `بانتظار موافقة شريكك · ${cardConfirmStatus.confirmedCount} / ${cardConfirmStatus.requiredCount}`
      : null;

  return (
    <div className={cn('pointer-events-none', className)}>
      <div
        className="pointer-events-auto absolute inset-x-2 top-[20%] flex items-start justify-between gap-3 sm:inset-x-5 sm:top-[22%] md:top-[24%]"
        data-testid="gc-special-cards-panel"
      >
        <PhysicalMiniCard
          variant="yellow"
          available={yellowAvailable}
          onOpen={() => setDetailCard('yellow')}
        />
        <PhysicalMiniCard
          variant="red"
          available={redAvailable}
          onOpen={() => setDetailCard('red')}
        />
      </div>

      {teammateRequest ? (
        <div
          className="pointer-events-auto absolute inset-x-2 top-2 z-20 sm:inset-x-4"
          data-testid="gc-teammate-card-request"
        >
          <div className="rounded-xl border border-amber-300/50 bg-slate-950/90 px-3 py-2.5 shadow-lg backdrop-blur-sm">
            <p className="text-sm font-bold text-amber-100">
              {teammateRequest.requestingPlayerName} يريد استخدام{' '}
              {teammateRequest.card === 'yellow' ? 'البطاقة الصفراء' : 'البطاقة الحمراء'}
            </p>
            <p className="mt-0.5 text-xs text-amber-50/90">تحتاج موافقتك</p>
            <p className="mt-1 text-[0.7rem] font-semibold text-amber-200">
              {teammateRequest.confirmedCount} / {teammateRequest.requiredCount}
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              data-testid="gc-review-card-request"
              onClick={() => setDetailCard(teammateRequest.card)}
            >
              عرض البطاقة
            </Button>
          </div>
        </div>
      ) : null}

      {waitingSelf ? (
        <div
          className="pointer-events-none absolute inset-x-2 top-2 z-10 sm:inset-x-4"
          data-testid="gc-card-confirm-status"
        >
          <p className="rounded-lg border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-center text-[0.75rem] font-semibold text-amber-100">
            {waitingSelf}
          </p>
        </div>
      ) : null}

      {activationMessage ? (
        <div
          className="pointer-events-none absolute inset-x-2 top-14 z-10 sm:inset-x-4"
          data-testid="gc-card-activated"
        >
          <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-center text-[0.75rem] font-semibold text-emerald-100">
            {activationMessage}
          </p>
        </div>
      ) : null}

      {detail && detailCard ? (
        <div
          className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-3"
          data-testid="gc-card-detail-backdrop"
          onClick={() => setDetailCard(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl"
            data-testid="gc-card-detail"
            data-card={detailCard}
            dir="rtl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-base font-bold text-wanas-text-primary">
              {detail.icon} {detail.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-wanas-text-muted">{detail.explanation}</p>
            <p
              className="mt-3 rounded-lg border border-rose-400/45 bg-rose-500/15 px-3 py-2 text-center text-xs font-bold text-rose-100"
              data-testid="gc-once-per-match-warning"
            >
              استخدام واحد فقط في المباراة
            </p>

            {confirmForDetail ? (
              <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
                {confirmForDetail.selfConfirmed ? (
                  <p>
                    بانتظار موافقة شريكك · {confirmForDetail.confirmedCount} /{' '}
                    {confirmForDetail.requiredCount}
                  </p>
                ) : (
                  <>
                    <p className="font-semibold">
                      {confirmForDetail.requestingPlayerName} وافق على الاستخدام
                    </p>
                    <p className="mt-1">
                      {confirmForDetail.confirmedCount} / {confirmForDetail.requiredCount}
                    </p>
                  </>
                )}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {detailAvailable ? (
                <Button
                  type="button"
                  data-testid="gc-confirm-card-use"
                  disabled={disabled || !detailCanUse || Boolean(confirmForDetail?.selfConfirmed)}
                  onClick={() => {
                    if (detailCard === 'yellow') {
                      onUseYellow();
                    } else {
                      onUseRed();
                    }
                  }}
                >
                  {confirmForDetail && !confirmForDetail.selfConfirmed
                    ? 'تأكيد الاستخدام'
                    : 'استخدام البطاقة'}
                </Button>
              ) : (
                <Button type="button" disabled data-testid="gc-confirm-card-use">
                  تم الاستخدام
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setDetailCard(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhysicalMiniCard({
  variant,
  available,
  onOpen,
}: {
  variant: CardVariant;
  available: boolean;
  onOpen: () => void;
}) {
  const copy = CARD_COPY[variant];
  const used = !available;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={variant === 'yellow' ? 'gc-yellow-card' : 'gc-red-card'}
      data-available={available ? 'true' : 'false'}
      data-compact="true"
      className={cn(
        'flex h-[4.6rem] w-[3.35rem] flex-col items-center justify-center rounded-lg border-2 px-1 py-1.5 text-center shadow-[0_10px_20px_rgba(0,0,0,0.35)] transition-transform sm:h-[5.1rem] sm:w-[3.7rem]',
        'hover:-translate-y-0.5 active:translate-y-0',
        variant === 'yellow' && 'border-amber-300/80 bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950',
        variant === 'red' && 'border-rose-300/80 bg-gradient-to-b from-rose-300 to-rose-600 text-rose-50',
        used && 'opacity-45 grayscale',
      )}
    >
      <span className="text-lg leading-none sm:text-xl" aria-hidden>
        {copy.icon}
      </span>
      <span className="mt-1 text-[0.62rem] font-extrabold leading-tight sm:text-[0.68rem]">
        {copy.shortName}
      </span>
      <span className="mt-0.5 text-[0.55rem] font-semibold opacity-90">
        {used ? 'تم الاستخدام' : 'متاحة'}
      </span>
    </button>
  );
}
