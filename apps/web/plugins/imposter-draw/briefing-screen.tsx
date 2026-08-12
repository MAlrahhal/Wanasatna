'use client';

import type { ImposterDrawReferenceImage } from '@wanasatna/shared';
import { GameCard, GameScreen } from '@/components/game/game-card';
import { GameHeader } from '@/components/game/game-header';
import { Button } from '@/components/ui/button';
import { IMPOSTER_DRAW_GAME_ICON, IMPOSTER_DRAW_GAME_NAME } from '@/lib/game/imposter-draw-brand';

export type ImposterDrawBriefingScreenProps = {
  role: 'crew' | 'impostor';
  referenceImage: ImposterDrawReferenceImage | null;
  remainingSeconds: number;
  currentRound: number;
  totalRounds: number;
  roomCode: string;
  acknowledged: boolean;
  isSubmitting?: boolean;
  onAcknowledge?: () => void;
  className?: string;
};

export function ImposterDrawBriefingScreen({
  role,
  referenceImage,
  remainingSeconds,
  currentRound,
  totalRounds,
  roomCode,
  acknowledged,
  isSubmitting = false,
  onAcknowledge,
  className,
}: ImposterDrawBriefingScreenProps) {
  const isImpostor = role === 'impostor';

  return (
    <GameScreen ariaLabel="كشف الدور" className={className}>
      <GameHeader
        gameName={IMPOSTER_DRAW_GAME_NAME}
        gameIcon={IMPOSTER_DRAW_GAME_ICON}
        roomCode={roomCode}
        currentRound={currentRound}
        totalRounds={totalRounds}
        phaseLabel="كشف الدور"
        timer={{ remainingSeconds, format: 'seconds', lowTimeThreshold: 5 }}
      />

      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 sm:gap-7">
        <GameCard className="px-5 py-8 text-center sm:px-10 sm:py-12">
          {isImpostor ? (
            <>
              <p className="text-xs font-medium text-wanas-text-muted">دورك</p>
              <p className="mt-3 text-3xl font-bold text-wanas-accent-hover sm:text-4xl">
                أنت الإمبوستر
              </p>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-wanas-text-secondary">
                ارسم بدون معرفة الصورة وحاول الاندماج مع بقية اللاعبين.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-wanas-text-muted">احفظ الصورة جيداً</p>
              {referenceImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={referenceImage.imageUrl}
                  alt={referenceImage.label}
                  className="mx-auto mt-4 max-h-64 w-full max-w-md rounded-2xl border border-[color:var(--wanas-game-card-border)] object-contain"
                />
              ) : null}
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-wanas-text-secondary">
                سترسم من الذاكرة. لن تظهر الصورة مرة أخرى خلال الجولة.
              </p>
            </>
          )}
        </GameCard>

        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          {acknowledged ? (
            <div
              className="flex min-h-12 items-center justify-center gap-2.5 rounded-2xl border border-wanas-success-border/80 bg-wanas-success-surface/50 px-4 py-3"
              role="status"
            >
              <p className="text-sm font-medium text-wanas-success-dark">
                بانتظار بقية اللاعبين...
              </p>
            </div>
          ) : null}

          <Button
            size="lg"
            className="min-h-11 w-full text-white focus-visible:ring-offset-4 sm:min-h-14"
            loading={isSubmitting}
            disabled={acknowledged || !onAcknowledge}
            onClick={onAcknowledge}
          >
            {acknowledged ? 'تم التأكيد' : 'فهمت'}
          </Button>
        </div>
      </div>
    </GameScreen>
  );
}
