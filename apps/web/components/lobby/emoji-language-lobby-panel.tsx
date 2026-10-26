'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EmojiLanguageLobbyView, EmojiLanguageSettings } from '@wanasatna/shared';
import {
  EMOJI_LANGUAGE_GUESSING_OPTIONS,
  EMOJI_LANGUAGE_LOBBY_SYNC_EVENT,
  EMOJI_LANGUAGE_PHASE_CHANGED_EVENT,
  EMOJI_LANGUAGE_PREPARATION_OPTIONS,
  EMOJI_LANGUAGE_ROUND_OPTIONS,
  EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT,
} from '@wanasatna/shared';
import { bindPluginViewResync } from '@/lib/game-plugins/bind-plugin-view-resync';
import { emitPluginWithAck } from '@/lib/game-plugins/emit';
import { getRoomSocket } from '@/lib/room/socket';
import { cn } from '@/lib/utils';

type ViewResponse = { view: EmojiLanguageLobbyView };

export function EmojiLanguageLobbyPanel({ isActiveMatch }: { isActiveMatch: boolean }) {
  const [view, setView] = useState<EmojiLanguageLobbyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    const response = await emitPluginWithAck<ViewResponse>(EMOJI_LANGUAGE_LOBBY_SYNC_EVENT);
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
    () => bindPluginViewResync(getRoomSocket(), EMOJI_LANGUAGE_PHASE_CHANGED_EVENT, sync),
    [sync],
  );

  async function update(settings: EmojiLanguageSettings) {
    if (!view?.canEditSettings || busy || isActiveMatch) return;
    setBusy(true);
    const response = await emitPluginWithAck<ViewResponse>(
      EMOJI_LANGUAGE_UPDATE_SETTINGS_EVENT,
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
        {error ?? 'جارٍ تحميل إعدادات لغة الإيموجي…'}
      </div>
    );
  }

  const editable = view.canEditSettings && !isActiveMatch && !busy;
  return (
    <div className="space-y-3" data-emoji-language-lobby="">
      <div className="border-wanas-accent/30 bg-wanas-primary-surface rounded-xl border p-3">
        <p className="text-wanas-text-primary text-sm font-bold">اختر طريقة اللعب</p>
        <p className="text-wanas-text-muted mt-1 text-xs">
          إما أن يصنع لاعب التلميح، أو تعرض اللعبة لغزًا جاهزًا. يرى الجميع الإعدادات نفسها.
        </p>
      </div>

      <fieldset disabled={!editable} className="space-y-3 disabled:opacity-75">
        <legend className="text-wanas-text-primary text-xs font-bold">وضع اللعب</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(
            [
              ['player-clue', 'لاعب يشرح', 'كاتب الجولة يصنع التلميح من لوحة الرموز.'],
              ['server-puzzle', 'لغز جاهز', 'الخادم يعرض لغز إيموجي مُعدًا مسبقًا.'],
            ] as const
          ).map(([mode, label, description]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view.settings.mode === mode}
              onClick={() => void update({ ...view.settings, mode })}
              className={cn(
                'min-h-16 rounded-xl border p-3 text-right disabled:cursor-default',
                view.settings.mode === mode
                  ? 'border-wanas-accent bg-wanas-primary-surface'
                  : 'border-wanas-border bg-wanas-surface-soft',
              )}
            >
              <span className="text-wanas-text-primary block text-sm font-bold">{label}</span>
              <span className="text-wanas-text-muted mt-1 block text-xs">{description}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SettingSelect
            label="عدد الجولات"
            value={view.settings.roundCount}
            options={EMOJI_LANGUAGE_ROUND_OPTIONS}
            suffix="جولات"
            onChange={(roundCount) => void update({ ...view.settings, roundCount })}
          />
          {view.settings.mode === 'player-clue' ? (
            <SettingSelect
              label="إعداد التلميح"
              value={view.settings.preparationSeconds}
              options={EMOJI_LANGUAGE_PREPARATION_OPTIONS}
              suffix="ثانية"
              onChange={(preparationSeconds) =>
                void update({ ...view.settings, preparationSeconds })
              }
            />
          ) : null}
          <SettingSelect
            label="وقت التخمين"
            value={view.settings.guessingSeconds}
            options={EMOJI_LANGUAGE_GUESSING_OPTIONS}
            suffix="ثانية"
            onChange={(guessingSeconds) => void update({ ...view.settings, guessingSeconds })}
          />
        </div>
      </fieldset>

      <p className="text-wanas-text-muted text-xs">
        جاهزون الآن: {view.participantCount} · يلزم {view.minPlayers} على الأقل للبدء.
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
