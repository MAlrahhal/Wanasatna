'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GuessingChallengeCardConfirmStatus } from '@wanasatna/shared';
import { Button } from '@/components/ui/button';
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
    explanation: 'تغيّر هوية الخصم إلى هوية جديدة من نفس الفئة.',
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
  activationMessage?: string | null;
  onUseYellow: () => void;
  onUseRed: () => void;
  onRejectCard?: () => void;
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
  onRejectCard,
  className,
}: GuessingChallengeSpecialCardsPanelProps) {
  const [detailCard, setDetailCard] = useState<CardVariant | null>(null);
  const [mounted, setMounted] = useState(false);
  const wasReviewingRequest = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (cardConfirmStatus && !cardConfirmStatus.selfConfirmed) {
      wasReviewingRequest.current = true;
      return;
    }
    if (!cardConfirmStatus) {
      if (wasReviewingRequest.current) {
        setDetailCard(null);
      }
      wasReviewingRequest.current = false;
    }
  }, [cardConfirmStatus]);

  const teammateRequest =
    cardConfirmStatus && !cardConfirmStatus.selfConfirmed ? cardConfirmStatus : null;

  const detail = detailCard ? CARD_COPY[detailCard] : null;
  const detailAvailable =
    detailCard === 'yellow' ? yellowAvailable : detailCard === 'red' ? redAvailable : false;
  const detailCanUse =
    detailCard === 'yellow' ? canUseYellow : detailCard === 'red' ? canUseRed : false;
  const confirmForDetail =
    detailCard && cardConfirmStatus?.card === detailCard ? cardConfirmStatus : null;
  const isReviewingTeammateRequest =
    Boolean(confirmForDetail) && confirmForDetail?.selfConfirmed === false;

  const waitingSelf =
    cardConfirmStatus?.selfConfirmed === true
      ? `بانتظار موافقة شريكك · ${cardConfirmStatus.confirmedCount} / ${cardConfirmStatus.requiredCount}`
      : null;

  const popup =
    detail && detailCard && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-3"
            data-testid="gc-card-detail-backdrop"
            onClick={() => setDetailCard(null)}
          >
            <div
              className="relative z-[201] max-h-[min(88dvh,100%)] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]"
              data-testid="gc-card-detail"
              data-card={detailCard}
              dir="rtl"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-lg font-bold text-wanas-text-primary">
                {detail.icon} {detail.title}
              </p>
              <p className="mt-2 text-sm leading-7 text-wanas-text-muted">{detail.explanation}</p>
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
                        {confirmForDetail.requestingPlayerName} يريد استخدام {detail.title}
                      </p>
                      <p className="mt-1">
                        {confirmForDetail.confirmedCount} / {confirmForDetail.requiredCount}
                      </p>
                    </>
                  )}
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {detailAvailable && (detailCanUse || isReviewingTeammateRequest) ? (
                  <Button
                    type="button"
                    className="min-h-11 w-full sm:w-auto"
                    data-testid="gc-confirm-card-use"
                    disabled={disabled || Boolean(confirmForDetail?.selfConfirmed)}
                    onClick={() => {
                      if (detailCard === 'yellow') {
                        onUseYellow();
                      } else {
                        onUseRed();
                      }
                      if (!confirmForDetail) {
                        setDetailCard(null);
                      }
                    }}
                  >
                    {isReviewingTeammateRequest ? 'موافقة' : 'استخدام البطاقة'}
                  </Button>
                ) : (
                  <Button type="button" className="min-h-11 w-full sm:w-auto" disabled data-testid="gc-confirm-card-use">
                    {detailAvailable ? 'ليست دور فريقكم' : 'تم الاستخدام'}
                  </Button>
                )}
                {isReviewingTeammateRequest && onRejectCard ? (
                  <Button
                    type="button"
                    variant="danger"
                    className="min-h-11 w-full sm:w-auto"
                    data-testid="gc-reject-card-use"
                    disabled={disabled}
                    onClick={() => {
                      onRejectCard();
                      setDetailCard(null);
                    }}
                  >
                    رفض
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  data-testid="gc-close-card-detail"
                  onClick={() => setDetailCard(null)}
                >
                  إغلاق
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn('pointer-events-none', className)}>
      <div
        className="pointer-events-none absolute inset-x-2 top-[18%] flex items-start justify-between gap-3 sm:inset-x-5 sm:top-[20%] md:top-[22%]"
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
          className="pointer-events-none absolute inset-x-2 top-2 z-20 sm:inset-x-4"
          data-testid="gc-teammate-card-request"
        >
          <div className="pointer-events-auto rounded-xl border border-amber-300/50 bg-slate-950/90 px-3 py-2.5 shadow-lg backdrop-blur-sm">
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
              className="mt-2 min-h-11"
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

      {popup}
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
      aria-label={`${copy.title} — ${used ? 'تم الاستخدام' : 'متاحة'}`}
      data-testid={variant === 'yellow' ? 'gc-yellow-card' : 'gc-red-card'}
      data-available={available ? 'true' : 'false'}
      data-compact="true"
      className={cn(
        'pointer-events-auto flex h-[4.25rem] w-[3.1rem] flex-col items-center justify-center rounded-xl border-2 px-1 py-1.5 text-center shadow-[0_12px_22px_rgba(0,0,0,0.4)] transition-transform sm:h-[5.2rem] sm:w-[3.75rem]',
        'hover:-translate-y-0.5 active:translate-y-0',
        variant === 'yellow' &&
          'border-amber-200 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 text-amber-950',
        variant === 'red' &&
          'border-rose-200 bg-gradient-to-b from-rose-300 via-rose-500 to-rose-700 text-rose-50',
        used && 'opacity-45 grayscale',
      )}
    >
      <span className="text-lg leading-none sm:text-xl" aria-hidden>
        {copy.icon}
      </span>
      <span className="mt-1 text-[0.7rem] font-extrabold leading-4 sm:text-[0.68rem]">
        {copy.shortName}
      </span>
      <span className="mt-0.5 text-[0.7rem] font-semibold leading-4 opacity-90">
        {used ? 'تم الاستخدام' : 'متاحة'}
      </span>
    </button>
  );
}
