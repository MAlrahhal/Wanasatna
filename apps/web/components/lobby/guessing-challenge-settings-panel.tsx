'use client';

import type { GuessingChallengeMode } from '@wanasatna/shared';
import { cn } from '@/lib/utils';

type GuessingChallengeSettingsPanelProps = {
  mode: GuessingChallengeMode;
  isHost: boolean;
  onChange: (mode: GuessingChallengeMode) => void;
};

const MODES: Array<{ id: GuessingChallengeMode; label: string; hint: string }> = [
  { id: '1v1', label: '1 ضد 1', hint: 'يلزم لاعبان' },
  { id: '2v2', label: '2 ضد 2', hint: 'يلزم 4 لاعبين' },
];

export function GuessingChallengeSettingsPanel({
  mode,
  isHost,
  onChange,
}: GuessingChallengeSettingsPanelProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-wanas-text-secondary">وضع اللعب</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MODES.map((entry) => {
          const selected = mode === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={!isHost}
              data-testid={`gc-lobby-mode-${entry.id}`}
              onClick={() => {
                if (!isHost) {
                  return;
                }
                onChange(entry.id);
              }}
              className={cn(
                'min-h-11 rounded-xl border px-3 py-3 text-start transition-colors',
                selected
                  ? 'border-wanas-accent bg-wanas-accent/10'
                  : 'border-wanas-border bg-wanas-surface-soft',
                !isHost && 'cursor-default opacity-80',
              )}
            >
              <p className="text-sm font-bold text-wanas-text-primary">{entry.label}</p>
              <p className="mt-1 text-[11px] text-wanas-text-muted">{entry.hint}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
