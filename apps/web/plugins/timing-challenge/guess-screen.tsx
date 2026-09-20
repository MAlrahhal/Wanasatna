'use client';

import { useState } from 'react';
import { AdPlacement } from '@/components/ads/ad-placement';
import { Button } from '@/components/ui/button';
import { ElectronicPanel } from './electronic-panel';
import { PeerStatusList } from './peer-status-list';
import type { TimingChallengePeerStatus } from '@wanasatna/shared';

type GuessScreenProps = {
  canGuess: boolean;
  selfSubmitted: boolean;
  peers: readonly TimingChallengePeerStatus[];
  currentPlayerId: string;
  isSubmitting: boolean;
  actionError: string | null;
  onSubmit: (guessSeconds: number) => void;
};

export function GuessScreen({
  canGuess,
  selfSubmitted,
  peers,
  currentPlayerId,
  isSubmitting,
  actionError,
  onSubmit,
}: GuessScreenProps) {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-4">
      <ElectronicPanel ariaLabel="تخمين الوقت">
        {selfSubmitted ? (
          <div className="text-center">
            <p className="text-wanas-accent text-lg font-bold">تم إرسال تخمينك</p>
            <p className="text-wanas-text-muted mt-2 text-sm">بانتظار بقية اللاعبين...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-wanas-text-primary text-center text-base font-bold">
              كم تتوقع كان الوقت؟
            </p>
            <div className="mx-auto flex max-w-xs flex-col gap-3">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="120"
                value={value}
                disabled={!canGuess || isSubmitting}
                onChange={(event) => setValue(event.target.value)}
                placeholder=""
                dir="ltr"
                className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary focus:border-wanas-accent h-12 rounded-xl border px-4 text-center font-mono text-xl font-bold outline-none"
              />
              <Button
                type="button"
                disabled={!canGuess || isSubmitting || value.trim() === ''}
                onClick={() => {
                  const parsed = Number(value);
                  if (!Number.isFinite(parsed)) {
                    return;
                  }
                  onSubmit(parsed);
                }}
                className="bg-wanas-accent hover:bg-wanas-accent-hover h-12 min-h-[44px] rounded-xl text-base font-bold text-white disabled:opacity-60"
              >
                إرسال التخمين
              </Button>
            </div>
            {actionError ? (
              <p className="text-destructive text-center text-sm">{actionError}</p>
            ) : null}
          </div>
        )}
      </ElectronicPanel>

      <AdPlacement placement="gameplay-primary" />

      <PeerStatusList peers={peers} currentPlayerId={currentPlayerId} />
    </div>
  );
}
