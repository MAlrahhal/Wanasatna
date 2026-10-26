'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TimelinePlacementLobbyView, TimelinePlacementSettings } from '@wanasatna/shared';
import {
  TIMELINE_PLACEMENT_LOBBY_SYNC_EVENT,
  TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT,
  TIMELINE_PLACEMENT_ROUND_OPTIONS,
  TIMELINE_PLACEMENT_SELECTION_OPTIONS,
  TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: TimelinePlacementLobbyView };

export function TimelinePlacementLobbyPanel({ isActiveMatch }: { isActiveMatch: boolean }) {
  const [view, setView] = useState<TimelinePlacementLobbyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    const response = await emitPluginWithAck<ViewResponse>(TIMELINE_PLACEMENT_LOBBY_SYNC_EVENT);
    if (response.success) {
      setView(response.data.view);
      setError(null);
    } else if (response.error.code === 'RATE_LIMITED') {
      return 'rate-limited' as const;
    } else {
      setError(response.error.message);
    }
  }, []);

  useEffect(
    () => bindPluginViewResync(getRoomSocket(), TIMELINE_PLACEMENT_PHASE_CHANGED_EVENT, sync),
    [sync],
  );

  async function update(settings: TimelinePlacementSettings) {
    if (!view?.canEditSettings || busy || isActiveMatch) return;
    setBusy(true);
    const response = await emitPluginWithAck<ViewResponse>(
      TIMELINE_PLACEMENT_UPDATE_SETTINGS_EVENT,
      settings,
    );
    if (response.success) {
      setView(response.data.view);
      setError(null);
    } else {
      setError(response.error.message);
    }
    setBusy(false);
  }

  if (!view) {
    return (
      <div className="border-wanas-border bg-wanas-surface-soft text-wanas-text-muted rounded-xl border p-3 text-sm">
        {error ?? 'جارٍ تحميل إعدادات زمانها وين؟…'}
      </div>
    );
  }

  const editable = view.canEditSettings && !isActiveMatch && !busy;
  return (
    <div className="space-y-3" data-timeline-placement-lobby="">
      <div className="border-wanas-accent/30 bg-wanas-primary-surface rounded-xl border p-3">
        <p className="text-wanas-text-primary text-sm font-bold">رتّبوا التاريخ معًا</p>
        <p className="text-wanas-text-muted mt-1 text-xs">
          ضع كل حدث بين حدثين معروفين، ويمكنك تغيير اختيارك حتى نهاية الوقت.
        </p>
      </div>

      <fieldset
        disabled={!editable}
        className="grid grid-cols-1 gap-2 disabled:opacity-75 sm:grid-cols-2"
      >
        <SettingSelect
          label="عدد الأحداث"
          value={view.settings.roundCount}
          options={TIMELINE_PLACEMENT_ROUND_OPTIONS}
          suffix="جولات"
          onChange={(roundCount) => void update({ ...view.settings, roundCount })}
        />
        <SettingSelect
          label="وقت الاختيار"
          value={view.settings.selectionSeconds}
          options={TIMELINE_PLACEMENT_SELECTION_OPTIONS}
          suffix="ثانية"
          onChange={(selectionSeconds) => void update({ ...view.settings, selectionSeconds })}
        />
      </fieldset>

      <p className="text-wanas-text-muted text-xs">
        جاهزون الآن: {view.participantCount} · المناسب {view.minPlayers}–{view.maxPlayers} لاعبين.
      </p>
      {error ? (
        <p role="alert" className="text-wanas-error text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SettingSelect<T extends number>(props: {
  label: string;
  value: T;
  options: readonly T[];
  suffix: string;
  onChange: (value: T) => void;
}) {
  return (
    <label className="border-wanas-border bg-wanas-surface-soft flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 text-xs">
      <span className="text-wanas-text-muted">{props.label}</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value) as T)}
        className="border-wanas-border bg-wanas-surface text-wanas-text-primary h-10 rounded-lg border px-2 font-bold"
      >
        {props.options.map((value) => (
          <option key={value} value={value}>
            {value} {props.suffix}
          </option>
        ))}
      </select>
    </label>
  );
}
