'use client';

import { useState } from 'react';
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
            <p className="text-lg font-bold text-wanas-accent">تم إرسال تخمينك</p>
            <p className="mt-2 text-sm text-wanas-text-muted">بانتظار بقية اللاعبين...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-base font-bold text-wanas-text-primary">
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
                placeholder="مثال: 7.25"
                dir="ltr"
                className="h-12 rounded-xl border border-wanas-border bg-wanas-surface-soft px-4 text-center font-mono text-xl font-bold text-wanas-text-primary outline-none focus:border-wanas-accent"
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
                className="h-12 min-h-[44px] rounded-xl bg-wanas-accent text-base font-bold text-[color:var(--wanas-background)] hover:bg-wanas-accent-hover disabled:opacity-60"
              >
                إرسال التخمين
              </Button>
            </div>
            {actionError ? (
              <p className="text-center text-sm text-destructive">{actionError}</p>
            ) : null}
          </div>
        )}
      </ElectronicPanel>

      <PeerStatusList peers={peers} currentPlayerId={currentPlayerId} />
    </div>
  );
}
