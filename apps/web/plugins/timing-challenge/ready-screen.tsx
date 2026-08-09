'use client';

import { Button } from '@/components/ui/button';
import { ElectronicPanel, DigitalReadout } from './electronic-panel';
import { PeerStatusList } from './peer-status-list';
import type { TimingChallengePeerStatus } from '@wanasatna/shared';
import { formatSecondsFromMs } from './format';

type ReadyScreenProps = {
  mode: 'guess-time' | 'stop-timer';
  targetMs: number | null;
  canReady: boolean;
  selfReady: boolean;
  peers: readonly TimingChallengePeerStatus[];
  currentPlayerId: string;
  isSubmitting: boolean;
  onReady: () => void;
};

export function ReadyScreen({
  mode,
  targetMs,
  canReady,
  selfReady,
  peers,
  currentPlayerId,
  isSubmitting,
  onReady,
}: ReadyScreenProps) {
  return (
    <div className="space-y-4">
      <ElectronicPanel ariaLabel="استعد للجولة">
        <p className="text-center text-sm font-semibold text-wanas-text-muted">استعد</p>
        {mode === 'stop-timer' && targetMs !== null ? (
          <div className="mt-4 space-y-2">
            <p className="text-center text-sm font-bold text-wanas-text-primary">
              حاول توقف المؤقت عند
            </p>
            <DigitalReadout value={formatSecondsFromMs(targetMs)} />
          </div>
        ) : (
          <p className="mt-4 text-center text-base font-bold text-wanas-text-primary">
            اعتمد على إحساسك بالوقت
          </p>
        )}

        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            disabled={!canReady || isSubmitting}
            onClick={onReady}
            className="h-12 min-h-[44px] min-w-[180px] rounded-xl bg-wanas-accent px-8 text-base font-bold text-[color:var(--wanas-background)] hover:bg-wanas-accent-hover disabled:opacity-60"
          >
            {selfReady ? 'بانتظار الباقي...' : 'ابدأ'}
          </Button>
        </div>
      </ElectronicPanel>

      <PeerStatusList peers={peers} currentPlayerId={currentPlayerId} />
    </div>
  );
}
