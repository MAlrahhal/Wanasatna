'use client';

import { useMemo } from 'react';
import type { AdminGameSettingSpec, RoomGameSettings, TimingChallengeSettings } from '@wanasatna/shared';
import {
  ADMIN_GAME_SETTING_SPECS,
  TIMING_CHALLENGE_ADMIN_MAX_SECONDS,
  TIMING_CHALLENGE_GAME_ID,
  getStoredGameSettingsForGame,
  settingSelectOptions,
} from '@wanasatna/shared';
import { cn } from '@/lib/utils';

type ExperimentalGameSettingsPanelProps = {
  gameId: string;
  roomSettings: RoomGameSettings | null;
  timingHostSettings?: TimingChallengeSettings;
  playerCount: number;
  onChange: (gameId: string, settings: Record<string, number>) => void;
};

const TIMING_SELECT_VALUES = [1, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120];

function optionsFor(spec: AdminGameSettingSpec, gameId: string): number[] {
  if (gameId === TIMING_CHALLENGE_GAME_ID) {
    return TIMING_SELECT_VALUES.filter((value) => value >= spec.min && value <= spec.max);
  }
  return settingSelectOptions(spec);
}

export function ExperimentalGameSettingsPanel({
  gameId,
  roomSettings,
  timingHostSettings,
  playerCount,
  onChange,
}: ExperimentalGameSettingsPanelProps) {
  const specs = ADMIN_GAME_SETTING_SPECS[gameId];
  const stored = useMemo(
    () => getStoredGameSettingsForGame(gameId, roomSettings),
    [gameId, roomSettings],
  );

  if (!specs || specs.length === 0) {
    return null;
  }

  function currentValue(spec: AdminGameSettingSpec): number {
    const storedValue = stored[spec.key];
    if (typeof storedValue === 'number') {
      return storedValue;
    }
    if (gameId === TIMING_CHALLENGE_GAME_ID && timingHostSettings) {
      if (spec.key === 'minSeconds') {
        return timingHostSettings.minSeconds;
      }
      if (spec.key === 'maxSeconds') {
        return timingHostSettings.maxSeconds;
      }
    }
    if (gameId === 'judge' && spec.key === 'rounds') {
      return 0;
    }
    return spec.default;
  }

  function emitChange(spec: AdminGameSettingSpec, nextValue: number) {
    if (gameId === TIMING_CHALLENGE_GAME_ID) {
      const minSeconds =
        spec.key === 'minSeconds' ? nextValue : currentValue(specs.find((item) => item.key === 'minSeconds')!);
      const maxSeconds =
        spec.key === 'maxSeconds' ? nextValue : currentValue(specs.find((item) => item.key === 'maxSeconds')!);
      const safeMax = Math.min(
        TIMING_CHALLENGE_ADMIN_MAX_SECONDS,
        Math.max(minSeconds + 1, maxSeconds),
      );
      const safeMin = Math.max(1, Math.min(minSeconds, safeMax - 1));
      onChange(gameId, { minSeconds: safeMin, maxSeconds: safeMax });
      return;
    }

    onChange(gameId, { [spec.key]: nextValue });
  }

  return (
    <div className="mt-2 rounded-lg border border-dashed border-wanas-border bg-wanas-surface-soft/60 px-3 py-2">
      <p className="text-[11px] font-semibold text-wanas-text-muted">إعدادات تجريبية</p>
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {specs.map((spec) => {
          const value = currentValue(spec);
          const isJudgeRounds = gameId === 'judge' && spec.key === 'rounds';
          return (
            <label
              key={spec.key}
              className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-wanas-border bg-wanas-surface px-3 py-2"
            >
              <span className="text-[11px] text-wanas-text-muted">{spec.label}</span>
              <select
                dir="ltr"
                value={value}
                onChange={(event) => emitChange(spec, Number(event.target.value))}
                className={cn(
                  'max-w-[7.5rem] rounded-md bg-transparent text-xs font-bold text-wanas-text-primary outline-none',
                )}
              >
                {isJudgeRounds ? (
                  <option value={0}>تلقائي ({Math.max(1, playerCount)})</option>
                ) : null}
                {optionsFor(spec, gameId)
                  .filter((option) => !(isJudgeRounds && option === 0))
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </label>
          );
        })}
      </div>
    </div>
  );
}
