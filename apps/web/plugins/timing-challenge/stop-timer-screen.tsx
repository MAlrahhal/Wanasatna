'use client';

import { useEffect, useRef } from 'react';
import { AdPlacement } from '@/components/ads/ad-placement';
import { Button } from '@/components/ui/button';
import { playGameSound, unlockGameAudio } from '@/lib/game/sounds';
import { DigitalTimerDisplay, ElectronicPanel } from './electronic-panel';
import { PeerStatusList } from './peer-status-list';
import { formatDigitalTimer, formatSignedDeltaMs, timingFeedbackLabel } from './format';
import { timingStartEventKey } from './timing-window-sfx';
import type { TimingChallengePeerStatus } from '@wanasatna/shared';
import { cn } from '@/lib/utils';

type StopTimerScreenProps = {
  roundId: string;
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

function playLocalTimerStartCue(roundId: string): void {
  unlockGameAudio();
  playGameSound('timing-window', { eventKey: timingStartEventKey(roundId, 'stop-timer') });
}

export function StopTimerScreen({
  roundId,
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
  const actionRef = useRef({
    roundId,
    canStartTimer,
    canStopTimer,
    isSubmitting,
    onStart,
    onStop,
  });

  useEffect(() => {
    actionRef.current = { roundId, canStartTimer, canStopTimer, isSubmitting, onStart, onStop };
  }, [roundId, canStartTimer, canStopTimer, isSubmitting, onStart, onStop]);

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
        playLocalTimerStartCue(current.roundId);
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
      <ElectronicPanel ariaLabel="أوقف الوقت" className="min-h-0 sm:min-h-[280px]">
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
                  selfSignedDeltaMs === 0 ? 'text-wanas-accent' : 'text-wanas-text-secondary',
                )}
                dir="ltr"
              >
                {formatSignedDeltaMs(selfSignedDeltaMs)}
              </p>
            ) : null}
            {feedback ? (
              <p className="text-wanas-text-primary text-sm font-semibold">{feedback}</p>
            ) : null}
            <p className="text-wanas-accent pt-2 text-sm font-bold">تم تسجيل توقيتك</p>
            <p className="text-wanas-text-muted text-xs">بانتظار بقية اللاعبين...</p>
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
                if (canStartTimer) {
                  playLocalTimerStartCue(roundId);
                  onStart();
                  return;
                }
                unlockGameAudio();
                if (canStopTimer) {
                  onStop();
                }
              }}
              className="bg-wanas-accent hover:bg-wanas-accent-hover mx-auto flex h-14 min-h-[44px] w-full max-w-sm items-center justify-center rounded-xl text-base font-bold text-white disabled:opacity-60"
            >
              {selfTimerRunning ? 'أوقف الآن' : 'اضغط لبدء المؤقت'}
            </Button>
          </div>
        )}

        {actionError ? (
          <p className="text-destructive mt-3 text-center text-sm">{actionError}</p>
        ) : null}
      </ElectronicPanel>

      <AdPlacement placement="gameplay-primary" />

      <PeerStatusList peers={peers} currentPlayerId={currentPlayerId} />
    </div>
  );
}
