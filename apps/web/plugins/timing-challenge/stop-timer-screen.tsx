'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { unlockGameAudio } from '@/lib/game/sounds';
import { DigitalTimerDisplay, ElectronicPanel } from './electronic-panel';
import { PeerStatusList } from './peer-status-list';
import { formatDigitalTimer, formatSignedDeltaMs, timingFeedbackLabel } from './format';
import type { TimingChallengePeerStatus } from '@wanasatna/shared';
import { cn } from '@/lib/utils';

type StopTimerScreenProps = {
  targetMs: number;
  canStartTimer: boolean;
  canStopTimer: boolean;
  selfTimerRunning: boolean;
  selfSubmitted: boolean;
  selfElapsedMs: number | null;
  selfSignedDeltaMs: number | null;
  selfErrorMs: number | null;
  peers: readonly TimingChallengePeerStatus[];
  currentPlayerId: string;
  isSubmitting: boolean;
  actionError: string | null;
  onStart: () => void;
  onStop: () => void;
};

export function StopTimerScreen({
  targetMs,
  canStartTimer,
  canStopTimer,
  selfTimerRunning,
  selfSubmitted,
  selfElapsedMs,
  selfSignedDeltaMs,
  selfErrorMs,
  peers,
  currentPlayerId,
  isSubmitting,
  actionError,
  onStart,
  onStop,
}: StopTimerScreenProps) {
  const actionRef = useRef({ canStartTimer, canStopTimer, isSubmitting, onStart, onStop });
  actionRef.current = { canStartTimer, canStopTimer, isSubmitting, onStart, onStop };

  useEffect(() => {
    if (!canStartTimer && !canStopTimer) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) {
        return;
      }

      event.preventDefault();

      const current = actionRef.current;
      if (current.isSubmitting) {
        return;
      }

      if (current.canStartTimer) {
        current.onStart();
        return;
      }

      if (current.canStopTimer) {
        current.onStop();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canStartTimer, canStopTimer]);

  const feedback = timingFeedbackLabel(selfErrorMs);

  return (
    <div className="space-y-4">
      <ElectronicPanel ariaLabel="أوقف الوقت" className="min-h-[280px]">
        <DigitalTimerDisplay
          value={formatDigitalTimer(targetMs)}
          label="الوقت المطلوب"
          className="mt-1"
        />

        {selfSubmitted && selfElapsedMs !== null ? (
          <div className="mt-6 space-y-3 text-center">
            <DigitalTimerDisplay value={formatDigitalTimer(selfElapsedMs)} label="توقيتك" />
            {selfSignedDeltaMs !== null ? (
              <p
                className={cn(
                  'font-mono text-lg font-bold',
                  selfSignedDeltaMs === 0
                    ? 'text-wanas-accent'
                    : 'text-wanas-text-secondary',
                )}
                dir="ltr"
              >
                {formatSignedDeltaMs(selfSignedDeltaMs)}
              </p>
            ) : null}
            {feedback ? (
              <p className="text-sm font-semibold text-wanas-text-primary">{feedback}</p>
            ) : null}
            <p className="pt-2 text-sm font-bold text-wanas-accent">تم تسجيل توقيتك</p>
            <p className="text-xs text-wanas-text-muted">بانتظار بقية اللاعبين...</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3 text-center">
            {selfTimerRunning ? (
              <DigitalTimerDisplay value="--:--.--" running label="المؤقت يعمل..." />
            ) : null}

            <Button
              type="button"
              disabled={(!canStartTimer && !canStopTimer) || isSubmitting}
              onClick={() => {
                unlockGameAudio();
                if (canStartTimer) {
                  onStart();
                  return;
                }
                if (canStopTimer) {
                  onStop();
                }
              }}
              className="mx-auto flex h-14 min-h-[44px] w-full max-w-sm items-center justify-center rounded-xl bg-wanas-accent text-base font-bold text-white hover:bg-wanas-accent-hover disabled:opacity-60"
            >
              {selfTimerRunning ? 'أوقف الآن' : 'اضغط لبدء المؤقت'}
            </Button>
          </div>
        )}

        {actionError ? (
          <p className="mt-3 text-center text-sm text-destructive">{actionError}</p>
        ) : null}
      </ElectronicPanel>

      <PeerStatusList peers={peers} currentPlayerId={currentPlayerId} />
    </div>
  );
}
