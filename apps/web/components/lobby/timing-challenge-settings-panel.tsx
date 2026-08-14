'use client';

import type { TimingChallengeMode, TimingChallengeSettings } from '@wanasatna/shared';
import {
  TIMING_CHALLENGE_ABSOLUTE_MAX_SECONDS,
  TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS,
} from '@wanasatna/shared';
import { cn } from '@/lib/utils';

type TimingChallengeSettingsPanelProps = {
  settings: TimingChallengeSettings;
  isHost: boolean;
  onChange: (next: TimingChallengeSettings) => void;
};

const MODES: Array<{ id: TimingChallengeMode; label: string; hint: string }> = [
  { id: 'guess-time', label: '🎯 تخمين الوقت', hint: 'مؤقت مخفي ثم تخمين الجميع' },
  { id: 'stop-timer', label: '⏱️ أوقف الوقت', hint: 'أوقف مؤقتك عند الهدف' },
];

export function TimingChallengeSettingsPanel({
  settings,
  isHost,
  onChange,
}: TimingChallengeSettingsPanelProps) {
  const update = (partial: Partial<TimingChallengeSettings>) => {
    if (!isHost) {
      return;
    }
    onChange({ ...settings, ...partial });
  };

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {MODES.map((mode) => {
          const selected = settings.mode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={!isHost}
              onClick={() => update({ mode: mode.id })}
              className={cn(
                'min-h-10 rounded-lg border px-3 py-2 text-start transition-colors',
                selected
                  ? 'border-wanas-accent bg-wanas-accent/10'
                  : 'border-wanas-border bg-wanas-surface-soft',
                !isHost && 'cursor-default opacity-80',
              )}
            >
              <p className="text-sm font-bold text-wanas-text-primary">{mode.label}</p>
              <p className="text-[11px] text-wanas-text-muted">{mode.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-2">
          <span className="block text-[11px] text-wanas-text-muted">الحد الأدنى (ث)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.05"
            min={TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS}
            max={TIMING_CHALLENGE_ABSOLUTE_MAX_SECONDS}
            disabled={!isHost}
            value={settings.minSeconds}
            onChange={(event) => update({ minSeconds: Number(event.target.value) })}
            dir="ltr"
            className="mt-1 w-full bg-transparent font-mono text-sm font-bold text-wanas-text-primary outline-none"
          />
        </label>
        <label className="rounded-lg border border-wanas-border bg-wanas-surface-soft px-3 py-2">
          <span className="block text-[11px] text-wanas-text-muted">الحد الأقصى (ث)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.05"
            min={TIMING_CHALLENGE_ABSOLUTE_MIN_SECONDS}
            max={TIMING_CHALLENGE_ABSOLUTE_MAX_SECONDS}
            disabled={!isHost}
            value={settings.maxSeconds}
            onChange={(event) => update({ maxSeconds: Number(event.target.value) })}
            dir="ltr"
            className="mt-1 w-full bg-transparent font-mono text-sm font-bold text-wanas-text-primary outline-none"
          />
        </label>
      </div>

      {settings.minSeconds >= settings.maxSeconds ? (
        <p className="text-xs font-medium text-wanas-error">
          الحد الأدنى يجب أن يكون أقل من الحد الأقصى.
        </p>
      ) : null}
    </div>
  );
}
