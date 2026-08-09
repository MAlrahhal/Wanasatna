'use client';

import { useState } from 'react';
import type { GuessingChallengeCardConfirmStatus } from '@wanasatna/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CardVariant = 'yellow' | 'red';

const CARD_COPY: Record<
  CardVariant,
  {
    title: string;
    explanation: string;
  }
> = {
  yellow: {
    title: 'البطاقة الصفراء',
    explanation: 'تمنح فريقك 3 أسئلة متتالية بدلاً من سؤال واحد.',
  },
  red: {
    title: 'البطاقة الحمراء',
    explanation: 'تغيّر هوية الفريق الخصم إلى هوية جديدة عشوائية من نفس الفئة.',
  },
};

export type GuessingChallengeSpecialCardsPanelProps = {
  yellowAvailable: boolean;
  redAvailable: boolean;
  canUseYellow: boolean;
  canUseRed: boolean;
  disabled?: boolean;
  cardConfirmStatus: GuessingChallengeCardConfirmStatus | null;
  onUseYellow: () => void;
  onUseRed: () => void;
  className?: string;
};

function availabilityLabel(available: boolean): string {
  return available ? 'متاحة — استخدام واحد فقط في المباراة' : 'تم استخدامها';
}

export function GuessingChallengeSpecialCardsPanel({
  yellowAvailable,
  redAvailable,
  canUseYellow,
  canUseRed,
  disabled = false,
  cardConfirmStatus,
  onUseYellow,
  onUseRed,
  className,
}: GuessingChallengeSpecialCardsPanelProps) {
  const [detailCard, setDetailCard] = useState<CardVariant | null>(null);

  const detail = detailCard ? CARD_COPY[detailCard] : null;
  const detailAvailable =
    detailCard === 'yellow' ? yellowAvailable : detailCard === 'red' ? redAvailable : false;
  const detailCanUse =
    detailCard === 'yellow' ? canUseYellow : detailCard === 'red' ? canUseRed : false;
  const confirmForDetail =
    detailCard && cardConfirmStatus?.card === detailCard ? cardConfirmStatus : null;

  const waitingMessage =
    cardConfirmStatus != null
      ? (cardConfirmStatus.message ||
          `بانتظار موافقة زميلك... ${cardConfirmStatus.confirmedCount}/${cardConfirmStatus.requiredCount}`)
      : null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-col gap-2" data-testid="gc-special-cards-panel">
        <CompactCard
          variant="yellow"
          available={yellowAvailable}
          disabled={disabled || !yellowAvailable}
          onOpen={() => setDetailCard('yellow')}
        />
        <CompactCard
          variant="red"
          available={redAvailable}
          disabled={disabled || !redAvailable}
          onOpen={() => setDetailCard('red')}
        />
      </div>

      {waitingMessage ? (
        <p
          className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-[0.7rem] leading-snug text-amber-100"
          data-testid="gc-card-confirm-status"
        >
          {waitingMessage}
        </p>
      ) : null}

      {detail && detailCard ? (
        <div
          className="wanas-game-card rounded-2xl border border-border p-3 sm:p-4"
          data-testid="gc-card-detail"
          data-card={detailCard}
        >
          <p className="text-sm font-bold text-wanas-text-primary">{detail.title}</p>
          <p className="mt-1.5 text-xs leading-5 text-wanas-text-muted">{detail.explanation}</p>
          <p
            className={cn(
              'mt-2 text-xs font-medium',
              detailAvailable ? 'text-emerald-300' : 'text-wanas-text-muted',
            )}
          >
            {availabilityLabel(detailAvailable)}
          </p>

          {confirmForDetail ? (
            <p className="mt-2 text-[0.7rem] text-amber-100">
              بانتظار موافقة زميلك... {confirmForDetail.confirmedCount}/
              {confirmForDetail.requiredCount}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {detailAvailable ? (
              <Button
                type="button"
                size="sm"
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
              <Button type="button" size="sm" disabled data-testid="gc-confirm-card-use">
                تم استخدامها
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => setDetailCard(null)}
            >
              إغلاق
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompactCard({
  variant,
  available,
  disabled,
  onOpen,
}: {
  variant: CardVariant;
  available: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  const copy = CARD_COPY[variant];
  const used = !available;

  return (
    <button
      type="button"
      disabled={disabled && used}
      onClick={onOpen}
      data-testid={variant === 'yellow' ? 'gc-yellow-card' : 'gc-red-card'}
      data-available={available ? 'true' : 'false'}
      className={cn(
        'flex min-h-[4.25rem] flex-col justify-center rounded-xl border px-2.5 py-2 text-right shadow-[0_8px_18px_rgb(0_0_0_/0.28)] transition-colors',
        variant === 'yellow' &&
          'border-amber-400/55 bg-amber-500/15 text-amber-100 disabled:border-amber-400/20 disabled:bg-amber-500/5 disabled:text-amber-100/50',
        variant === 'red' &&
          'border-rose-400/55 bg-rose-500/15 text-rose-100 disabled:border-rose-400/20 disabled:bg-rose-500/5 disabled:text-rose-100/50',
        used && 'opacity-55 grayscale-[0.35]',
        !used && 'hover:bg-white/5',
      )}
    >
      <span className="text-xs font-bold">{copy.title}</span>
      <span className="mt-1 text-[0.65rem] leading-snug text-wanas-text-muted">
        {used ? 'تم استخدامها' : 'استخدام واحد فقط في المباراة'}
      </span>
    </button>
  );
}
