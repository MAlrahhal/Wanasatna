'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OneWordOnlyLobbyView, OneWordOnlySettings } from '@wanasatna/shared';
import {
  ONE_WORD_ONLY_CLUE_SECONDS_OPTIONS,
  ONE_WORD_ONLY_GUESS_SECONDS_OPTIONS,
  ONE_WORD_ONLY_LOBBY_SYNC_EVENT,
  ONE_WORD_ONLY_PHASE_CHANGED_EVENT,
  ONE_WORD_ONLY_ROUND_OPTIONS,
  ONE_WORD_ONLY_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';

type ViewResponse = { view: OneWordOnlyLobbyView };

export function OneWordOnlyLobbyPanel({ isActiveMatch }: { isActiveMatch: boolean }) {
  const [view, setView] = useState<OneWordOnlyLobbyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    const response = await emitPluginWithAck<ViewResponse>(ONE_WORD_ONLY_LOBBY_SYNC_EVENT, {});
    if (response.success) {
      setView(response.data.view);
      setError(null);
    } else if (response.error.code === 'RATE_LIMITED') {
      return 'rate-limited' as const;
    } else setError(response.error.message);
  }, []);

  useEffect(
    () => bindPluginViewResync(getRoomSocket(), ONE_WORD_ONLY_PHASE_CHANGED_EVENT, sync),
    [sync],
  );

  async function update(settings: OneWordOnlySettings) {
    if (!view?.canEditSettings || busy || isActiveMatch) return;
    setBusy(true);
    const response = await emitPluginWithAck<ViewResponse>(
      ONE_WORD_ONLY_UPDATE_SETTINGS_EVENT,
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
        {error ?? 'جارٍ تحميل إعدادات كلمة وحدة بس…'}
      </div>
    );
  }

  const editable = view.canEditSettings && !isActiveMatch && !busy;
  return (
    <div className="space-y-3" data-one-word-only-lobby="">
      <div className="border-wanas-accent/30 bg-wanas-primary-surface rounded-xl border p-3">
        <p className="text-wanas-text-primary text-sm font-bold">تحدٍ تعاوني بكلمة واحدة</p>
        <p className="text-wanas-text-muted mt-1 text-xs">
          يكتب كل لاعب تلميحًا واحدًا، ثم يحاول المخمّن الوصول إلى الإجابة الصحيحة.
        </p>
      </div>
      <fieldset
        disabled={!editable}
        className="grid grid-cols-1 gap-2 disabled:opacity-75 sm:grid-cols-3"
      >
        <SettingSelect
          label="عدد الجولات"
          value={view.settings.roundCount}
          options={ONE_WORD_ONLY_ROUND_OPTIONS}
          suffix="جولات"
          onChange={(roundCount) => void update({ ...view.settings, roundCount })}
        />
        <SettingSelect
          label="وقت التلميح"
          value={view.settings.clueSeconds}
          options={ONE_WORD_ONLY_CLUE_SECONDS_OPTIONS}
          suffix="ثانية"
          onChange={(clueSeconds) => void update({ ...view.settings, clueSeconds })}
        />
        <SettingSelect
          label="وقت التخمين"
          value={view.settings.guessSeconds}
          options={ONE_WORD_ONLY_GUESS_SECONDS_OPTIONS}
          suffix="ثانية"
          onChange={(guessSeconds) => void update({ ...view.settings, guessSeconds })}
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
