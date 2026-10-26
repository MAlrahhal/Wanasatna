'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EyewitnessLobbyView, EyewitnessSettings } from '@wanasatna/shared';
import {
  EYEWITNESS_DESCRIPTION_SECONDS_OPTIONS,
  EYEWITNESS_DRAWING_SECONDS_OPTIONS,
  EYEWITNESS_LOBBY_SYNC_EVENT,
  EYEWITNESS_PHASE_CHANGED_EVENT,
  EYEWITNESS_ROUND_OPTIONS,
  EYEWITNESS_UPDATE_SETTINGS_EVENT,
  EYEWITNESS_VOTING_SECONDS_OPTIONS,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: EyewitnessLobbyView };

export function EyewitnessLobbyPanel({ isActiveMatch }: { isActiveMatch: boolean }) {
  const [view, setView] = useState<EyewitnessLobbyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    const response = await emitPluginWithAck<ViewResponse>(EYEWITNESS_LOBBY_SYNC_EVENT, {});
    if (response.success) {
      setView(response.data.view);
      setError(null);
    } else if (response.error.code === 'RATE_LIMITED') {
      return 'rate-limited' as const;
    } else setError(response.error.message);
  }, []);

  useEffect(
    () => bindPluginViewResync(getRoomSocket(), EYEWITNESS_PHASE_CHANGED_EVENT, sync),
    [sync],
  );

  async function update(settings: EyewitnessSettings) {
    if (!view?.canEditSettings || busy || isActiveMatch) return;
    setBusy(true);
    const response = await emitPluginWithAck<ViewResponse>(
      EYEWITNESS_UPDATE_SETTINGS_EVENT,
      settings,
    );
    if (response.success) {
      setView(response.data.view);
      setError(null);
    } else setError(response.error.message);
    setBusy(false);
  }

  if (!view) {
    return (
      <div className="border-wanas-border bg-wanas-surface-soft text-wanas-text-muted rounded-xl border p-3 text-sm">
        {error ?? 'جارٍ تحميل إعدادات شاهد عيان…'}
      </div>
    );
  }

  const editable = view.canEditSettings && !isActiveMatch && !busy;
  return (
    <div className="space-y-3" data-eyewitness-lobby="">
      <div className="border-wanas-accent/30 bg-wanas-primary-surface rounded-xl border p-3">
        <p className="text-wanas-text-primary text-sm font-bold">صف، ارسم، ثم صوّت</p>
        <p className="text-wanas-text-muted mt-1 text-xs">
          يشاهد شخص واحد الصورة، ويحوّل الآخرون وصفه إلى رسومات مجهولة حتى النتائج.
        </p>
      </div>
      <fieldset
        disabled={!editable}
        className="grid grid-cols-1 gap-2 disabled:opacity-75 sm:grid-cols-2"
      >
        <SettingSelect
          label="عدد الجولات"
          value={view.settings.roundCount}
          options={EYEWITNESS_ROUND_OPTIONS}
          suffix="جولة"
          onChange={(roundCount) => void update({ ...view.settings, roundCount })}
        />
        <SettingSelect
          label="المشاهدة والوصف"
          value={view.settings.descriptionSeconds}
          options={EYEWITNESS_DESCRIPTION_SECONDS_OPTIONS}
          suffix="ثانية"
          onChange={(descriptionSeconds) => void update({ ...view.settings, descriptionSeconds })}
        />
        <SettingSelect
          label="وقت الرسم"
          value={view.settings.drawingSeconds}
          options={EYEWITNESS_DRAWING_SECONDS_OPTIONS}
          suffix="ثانية"
          onChange={(drawingSeconds) => void update({ ...view.settings, drawingSeconds })}
        />
        <SettingSelect
          label="وقت التصويت"
          value={view.settings.votingSeconds}
          options={EYEWITNESS_VOTING_SECONDS_OPTIONS}
          suffix="ثانية"
          onChange={(votingSeconds) => void update({ ...view.settings, votingSeconds })}
        />
      </fieldset>
      <p className="text-wanas-text-muted text-xs">
        جاهزون الآن: {view.participantCount} · يلزم {view.minPlayers} لاعبين على الأقل.
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
